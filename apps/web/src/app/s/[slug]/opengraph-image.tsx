import { formatPocketCode, generateSpreads } from "@sleevebook/binder-core";
import { ImageResponse } from "next/og";
import { getBinderWithLayout, getVariantDisplays } from "../../../lib/binders";
import { getPublishedBinderBySlug } from "../../../lib/share";

export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VELVET = "radial-gradient(ellipse at 50% 30%, #2a221c 0%, #14110f 70%)";
const LINEN = "#ede6da";
const SMOKE = "#a39a8e";
const FOIL = "#d4b77c";

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
        <div style={{ fontSize: 18, letterSpacing: 6, color: FOIL }}>SLEEVEBOOK</div>
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
              style={{ borderRadius: 8, boxShadow: "0 18px 40px rgba(0,0,0,0.6)" }}
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
            background: "linear-gradient(160deg, #3a2c22, #1d1612)",
            border: `1px solid ${FOIL}`,
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 26,
            color: FOIL,
            fontSize: 14,
            letterSpacing: 4,
          }}
        >
          BINDER
        </div>
      )}
      <div style={{ display: "flex", fontSize: 18, color: SMOKE }}>Colección en Sleevebook</div>
    </div>,
    size,
  );
}
