import { type Currency, formatMoney } from "@sleevebook/binder-core";
import type { CSSProperties, ReactNode } from "react";

// Shared header language for binder pages: a bold sans title and compact chips
// for progress and value. Server-safe: no hooks.

const CHIP_STYLE: CSSProperties = {
  display: "inline-flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "2px 6px",
  minHeight: 32,
  margin: 0,
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 13,
  lineHeight: 1.3,
};

export function BinderTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      className="sb-display"
      style={{
        margin: 0,
        fontSize: "clamp(22px, 2.4vw, 24px)",
        lineHeight: 1.15,
        fontWeight: 800,
        color: "var(--ink)",
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
  const complete = total > 0 && owned >= total;
  return (
    <p
      style={{
        ...CHIP_STYLE,
        background: complete ? "var(--success-soft)" : "var(--accent-soft)",
        color: complete ? "var(--success)" : "var(--accent)",
        fontWeight: 600,
      }}
    >
      <span>Avance del objetivo: </span>
      <span className="sb-data" style={{ fontWeight: 800 }}>
        {owned} / {total}
      </span>
      <span className="sb-data"> ({percentage}%)</span>
      {complete && <span> · Completo</span>}
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
        ...CHIP_STYLE,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        color: "var(--ink)",
        fontWeight: 600,
      }}
    >
      <span>Valor total: </span>
      <span className="sb-data" style={{ fontWeight: 800 }}>
        {formatDisplayMoney(amount, currency)}
      </span>
      {note && (
        <span className="sb-data" style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)" }}>
          {note}
        </span>
      )}
    </p>
  );
}
