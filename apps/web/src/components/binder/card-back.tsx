import type { CSSProperties } from "react";

const ASPECT_RATIO = 88 / 63;
const CORNER_RATIO = 0.045;

// Sleevebook card back (v2 "Estante"): a blue field with a white inner frame
// and a friendly mark: a rounded tile holding a stylised card-sleeve glyph.
// Deliberately unrelated to any third-party card back (no ball, no swirl).
const BLUE = "#3451d1";
const BLUE_DEEP = "#2238a8";
const WHITE = "#ffffff";

export function CardBack({ width }: { width: number }) {
  const height = Math.round(width * ASPECT_RATIO);
  const radius = Math.round(width * CORNER_RATIO);

  const root: CSSProperties = {
    position: "relative",
    width,
    height,
    borderRadius: radius,
    overflow: "hidden",
    boxShadow: "0 18px 40px rgba(27, 32, 51, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
    background: `linear-gradient(160deg, ${BLUE} 0%, ${BLUE_DEEP} 100%)`,
  };

  const outerFrame: CSSProperties = {
    position: "absolute",
    inset: Math.round(width * 0.04),
    borderRadius: Math.round(width * 0.03),
    border: `${Math.max(1, Math.round(width * 0.008))}px solid ${WHITE}`,
    opacity: 0.9,
  };

  const innerFrame: CSSProperties = {
    position: "absolute",
    inset: Math.round(width * 0.075),
    borderRadius: Math.round(width * 0.018),
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.35)",
  };

  const center: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: Math.round(width * 0.05),
  };

  const tile = Math.round(width * 0.36);

  return (
    <div data-testid="card-back" role="img" aria-label="Reverso de carta Sleevebook" style={root}>
      <div style={outerFrame} />
      <div style={innerFrame} />
      <div style={center}>
        <svg
          width={tile}
          height={tile}
          viewBox="0 0 24 24"
          fill="none"
          stroke={WHITE}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
          style={{
            display: "block",
            background: "rgba(255, 255, 255, 0.14)",
            borderRadius: Math.round(tile * 0.28),
            padding: Math.round(tile * 0.14),
            boxSizing: "border-box",
          }}
        >
          <rect x="5" y="3.5" width="11" height="15" rx="2" transform="rotate(-8 10.5 11)" />
          <rect x="8" y="5.5" width="11" height="15" rx="2" fill="rgba(255,255,255,0.18)" />
          <path d="M11.5 10.2c-.9-1.2-2.8-.6-2.5.9.2 1.1 2.5 2.2 2.5 3.4 0 .4-.2.6-.5.6" />
        </svg>
        <span
          style={{
            color: WHITE,
            fontFamily: "var(--font-display)",
            fontSize: Math.max(9, Math.round(width * 0.085)),
            fontWeight: 800,
            letterSpacing: "-0.01em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          Sleevebook
        </span>
      </div>
    </div>
  );
}
