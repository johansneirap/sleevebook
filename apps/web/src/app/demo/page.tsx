import { formatPocketCode } from "@sleevebook/binder-core";
import { demoImageUrls, sampleLayout } from "../../sample-layout";

export default function DemoPage() {
  const { rows, cols } = sampleLayout.format;
  const pocketCodes = Array.from({ length: rows * cols }, (_, i) =>
    formatPocketCode({ sheet: 1, side: "F", index: i + 1 }),
  );

  return (
    <main>
      <h1>Sleevebook — demo</h1>
      <div
        data-testid="binder-face"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 8,
          maxWidth: 480,
        }}
      >
        {pocketCodes.map((code) => {
          const content = sampleLayout.pockets[code];
          return (
            <div
              key={code}
              data-testid="pocket"
              data-pocket-code={code}
              style={{
                aspectRatio: "63 / 88",
                border: "1px solid #ccc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {content?.kind === "card" ? (
                // biome-ignore lint/performance/noImgElement: static demo page, no next/image optimization needed yet
                <img
                  src={demoImageUrls[content.variant]}
                  alt={code}
                  style={{ maxWidth: "100%", maxHeight: "100%" }}
                />
              ) : content?.kind === "placeholder" ? (
                <span>Placeholder</span>
              ) : (
                <span style={{ opacity: 0.3 }}>Vacío</span>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
