import { formatPocketCode, generateSpreads } from "@sleevebook/binder-core";
import { ImageResponse } from "next/og";
import { getBinderWithLayout, getVariantDisplays } from "../../../lib/binders";
import { getPublishedBinderBySlug } from "../../../lib/share";

export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const publicBinder = await getPublishedBinderBySlug(slug);

  if (!publicBinder) {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a2e",
          color: "white",
          fontSize: 64,
          fontWeight: 700,
        }}
      >
        Sleevebook
      </div>,
      size,
    );
  }

  const binderData = await getBinderWithLayout(publicBinder.id);
  const firstFace = binderData ? generateSpreads(binderData.sheets)[0]?.faces[0] : undefined;

  const imageUrls: string[] = [];
  if (binderData && firstFace) {
    const { format, pockets } = binderData.layout;
    const variantIds = new Set<string>();
    for (let i = 1; i <= format.rows * format.cols; i++) {
      const code = formatPocketCode({ sheet: firstFace.sheet, side: firstFace.side, index: i });
      const content = pockets[code];
      if (content?.kind === "card") {
        variantIds.add(content.variant);
      }
    }
    const displays = await getVariantDisplays([...variantIds]);
    for (const id of variantIds) {
      const url = displays.get(id)?.imageUrl;
      if (url) {
        imageUrls.push(url);
      }
    }
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#1a1a2e",
        color: "white",
        padding: 56,
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 700 }}>{publicBinder.name}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 32 }}>
        {imageUrls.slice(0, 9).map((src) => (
          // biome-ignore lint/performance/noImgElement: next/og's ImageResponse renders via satori, which requires a plain <img>
          <img key={src} src={src} width={140} height={195} alt="" style={{ borderRadius: 8 }} />
        ))}
      </div>
    </div>,
    size,
  );
}
