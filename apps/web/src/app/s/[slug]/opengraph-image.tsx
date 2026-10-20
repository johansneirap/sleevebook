import { formatPocketCode, generateSpreads } from "@sleevebook/binder-core";
import { ImageResponse } from "next/og";
import { getBinderWithLayout, getVariantDisplays } from "../../../lib/binders";
import { getPublishedBinderBySlug } from "../../../lib/share";

export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Design brief v2 ("Estante"): light desk, ink text, one blue accent.
const VELVET = "radial-gradient(ellipse at 50% 35%, #ffffff 0%, #f5f6fa 75%)";
const LINEN = "#1b2033";
const SMOKE = "#5b6278";
const FOIL = "#3451d1";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const publicBinder = await getPublishedBinderBySlug(slug);
  const binderData = publicBinder ? await getBinderWithLayout(publicBinder.id) : null;

  // The first face that actually holds cards (sheet 1's front is often empty).
  const imageUrls: Array<{ code: string; url: string }> = [];
  if (binderData) {
    const { format, pockets } = binderData.layout;
    const faces = generateSpreads(binderData.sheets).flatMap((spread) => spread.faces);
    for (const face of faces) {
      const held: Array<{ code: string; variant: string }> = [];
      for (let i = 1; i <= format.rows * format.cols; i++) {
        const code = formatPocketCode({ sheet: face.sheet, side: face.side, index: i });
        const content = pockets[code];
        if (content?.kind === "card") {
          held.push({ code, variant: content.variant });
        }
      }
      if (held.length > 0) {
        const displays = await getVariantDisplays(held.map((h) => h.variant));
        for (const { code, variant } of held) {
          const url = displays.get(variant)?.imageUrl;
          if (url) {
            imageUrls.push({ code, url });
          }
        }
        break;
      }
    }
  }
  const name = publicBinder?.name ?? "Sleevebook";
  const cards = imageUrls.slice(0, 5);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: VELVET,
        color: LINEN,
        padding: "52px 64px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: FOIL }}>Sleevebook</div>
        <div style={{ fontSize: 60, lineHeight: 1.05, maxWidth: 1000 }}>{name}</div>
      </div>
      {cards.length > 0 ? (
        <div style={{ display: "flex", gap: 22, alignItems: "flex-end" }}>
          {cards.map(({ code, url }) => (
            // biome-ignore lint/performance/noImgElement: next/og's ImageResponse renders via satori, which requires a plain <img>
            <img
              key={code}
              src={url}
              width={176}
              height={246}
              alt=""
              style={{ borderRadius: 8, boxShadow: "0 12px 28px rgba(27,32,51,0.28)" }}
            />
          ))}
        </div>
      ) : (
        // No cards yet: the closed binder's cover.
        <div
          style={{
            display: "flex",
            width: 220,
            height: 268,
            borderRadius: 6,
            background: "linear-gradient(160deg, #2f4a8a, #1d2e56)",
            border: "1px dashed rgba(255,255,255,0.35)",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 26,
            color: "#ffffff",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Binder
        </div>
      )}
      <div style={{ display: "flex", fontSize: 18, color: SMOKE }}>Colección en Sleevebook</div>
    </div>,
    size,
  );
}
