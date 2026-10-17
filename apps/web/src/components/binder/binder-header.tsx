import { type Currency, formatMoney } from "@sleevebook/binder-core";
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

/** USD keeps the historical "$12.50 USD" form; other currencies use Intl formatting. */
export function formatDisplayMoney(amount: number, currency: Currency): string {
  return currency === "usd" ? `$${amount.toFixed(2)} USD` : formatMoney(amount, currency);
}

/** Fecha de un tipo de cambio en formato chileno, para "tipo de cambio al …". */
export function formatRateDate(capturedAtIso: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  }).format(new Date(capturedAtIso));
}

export function ValueFigure({
  amount,
  currency,
  note,
}: {
  amount: number;
  currency: Currency;
  /** Small quiet note next to the figure, e.g. the rate date or "sin tipo de cambio". */
  note?: string;
}) {
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
        {formatDisplayMoney(amount, currency)}
      </span>
      {note && (
        <span className="sb-data" style={{ fontSize: 13, color: "var(--smoke)" }}>
          {note}
        </span>
      )}
    </p>
  );
}
