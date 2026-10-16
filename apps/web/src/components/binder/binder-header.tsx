import type { CSSProperties, ReactNode } from "react";

// Shared header language for binder pages: serif title, catalog-style figures
// (big serif or tabular mono numbers with a small-caps label). Server-safe: no hooks.

const LABEL_STYLE: CSSProperties = {
  fontSize: 11,
  color: "var(--smoke)",
  textTransform: "uppercase",
};

export function BinderTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      className="sb-display"
      style={{
        margin: 0,
        fontSize: "clamp(40px, 7vw, 76px)",
        lineHeight: 1.02,
        fontWeight: 400,
        color: "var(--linen)",
        overflowWrap: "anywhere",
        textWrap: "balance",
      }}
    >
      {children}
    </h1>
  );
}

export function ProgressFigure({
  owned,
  total,
  percentage,
}: {
  owned: number;
  total: number;
  percentage: number;
}) {
  return (
    <p
      style={{
        margin: 0,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        gap: "4px 14px",
      }}
    >
      <span className="sb-label" style={LABEL_STYLE}>
        Avance del objetivo:{" "}
      </span>
      <span
        className="sb-display"
        style={{
          fontSize: "clamp(44px, 8vw, 68px)",
          lineHeight: 1,
          color: "var(--foil)",
          fontVariantNumeric: "lining-nums tabular-nums",
        }}
      >
        {owned} / {total}
      </span>
      <span className="sb-data" style={{ fontSize: 15, color: "var(--smoke)" }}>
        {" "}
        ({percentage}%)
      </span>
    </p>
  );
}

export function ValueFigure({ valueUsd }: { valueUsd: number }) {
  return (
    <p
      style={{
        margin: 0,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        gap: "4px 12px",
      }}
    >
      <span className="sb-label" style={LABEL_STYLE}>
        Valor total:{" "}
      </span>
      <span
        className="sb-data"
        style={{ fontSize: "clamp(26px, 4vw, 34px)", color: "var(--linen)" }}
      >
        ${valueUsd.toFixed(2)}
      </span>
      <span className="sb-data" style={{ fontSize: 13, color: "var(--smoke)" }}>
        {" "}
        USD
      </span>
    </p>
  );
}
