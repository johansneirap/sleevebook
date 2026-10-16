import type { CSSProperties } from "react";

const ASPECT_RATIO = 88 / 63;
const CORNER_RATIO = 0.045;

// Original Sleevebook card back: a warm velvet-and-leather field, a thin
// champagne-gold filete and a small-caps wordmark. Deliberately unrelated to
// any third-party card back design (no ball motif, no swirl, no logos).
const GOLD = "#d9b979";
const GOLD_SOFT = "rgba(217, 185, 121, 0.45)";

export function CardBack({ width }: { width: number }) {
  const height = Math.round(width * ASPECT_RATIO);
  const radius = Math.round(width * CORNER_RATIO);

  const root: CSSProperties = {
    position: "relative",
    width,
    height,
    borderRadius: radius,
    overflow: "hidden",
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
    background: [
      // soft warm light falling from the upper left
      "radial-gradient(ellipse 80% 60% at 28% 18%, rgba(255, 226, 190, 0.10), transparent 70%)",
      // fine diagonal grain, like stitched leather
      "repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.025) 0px, rgba(255, 255, 255, 0.025) 1px, transparent 1px, transparent 4px)",
      // velvet-to-leather body
      "linear-gradient(160deg, #3b2318 0%, #22130e 52%, #140b08 100%)",
    ].join(", "),
  };

  const outerFrame: CSSProperties = {
    position: "absolute",
    inset: Math.round(width * 0.035),
    borderRadius: Math.round(width * 0.02),
    border: `${Math.max(1, Math.round(width * 0.008))}px solid ${GOLD}`,
    opacity: 0.85,
  };

  const innerFrame: CSSProperties = {
    position: "absolute",
    inset: Math.round(width * 0.055),
    borderRadius: Math.round(width * 0.012),
    border: `1px solid ${GOLD_SOFT}`,
  };

  const center: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: Math.round(width * 0.06),
  };

  const ornament: CSSProperties = {
    display: "block",
    width: Math.round(width * 0.42),
    height: 1,
    background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
  };

  return (
    <div data-testid="card-back" role="img" aria-label="Reverso de carta Sleevebook" style={root}>
      <div style={outerFrame} />
      <div style={innerFrame} />
      <div style={center}>
        <span style={ornament} />
        <span
          style={{
            color: GOLD,
            fontFamily: "var(--font-display)",
            fontSize: Math.max(8, Math.round(width * 0.088)),
            fontWeight: 400,
            letterSpacing: "0.32em",
            // trailing letter-spacing would shift the centered word off-axis
            marginRight: "-0.32em",
            lineHeight: 1,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Sleevebook
        </span>
        <span style={ornament} />
      </div>
    </div>
  );
}
