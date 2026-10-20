"use client";

import { formatMoney } from "@sleevebook/binder-core";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { SellerContactButtons } from "./seller-contact-buttons";
import { SELLER_CSS } from "./seller-css";
import { useWantList } from "./want-list";
import { buildWantListText, sumWantPrices } from "./want-list-text";

const TRAY_STYLE: CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: "max(12px, env(safe-area-inset-bottom, 0px))",
  transform: "translateX(-50%)",
  zIndex: 40,
  boxSizing: "border-box",
  width: "min(480px, calc(100vw - 24px))",
  padding: 16,
  borderRadius: "var(--radius-lg)",
  background: "var(--surface)",
  border: "1px solid var(--line)",
  boxShadow: "0 12px 32px rgba(27, 32, 51, 0.16), 0 2px 6px rgba(27, 32, 51, 0.08)",
  color: "var(--ink)",
  fontSize: 14,
};

const CHIP_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 28,
  padding: "4px 10px",
  borderRadius: 999,
  background: "var(--surface-2)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink)",
};

const TOGGLE_STYLE: CSSProperties = {
  marginLeft: "auto",
  minHeight: 44,
  padding: "0 10px",
  background: "none",
  border: 0,
  borderRadius: 10,
  color: "var(--accent)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const COPY_STYLE: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 44,
  padding: "0 18px",
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

/** Buyer's "Copiar lista" tray, fixed at the bottom of a seller binder. */
export function SellerTray() {
  const want = useWantList();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timer = setTimeout(() => setFeedback(null), 2400);
    return () => clearTimeout(timer);
  }, [feedback]);

  if (!want) {
    return null;
  }

  const { items, currency, binderName, url, remove } = want;
  const count = items.length;
  const pricedCount = items.filter((item) => item.price).length;
  const text = buildWantListText({ binderName, url, items, currency });

  async function copyList() {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Lista copiada");
    } catch {
      setFeedback("No se pudo copiar");
    }
  }

  return (
    <aside aria-label="Mi lista" data-testid="seller-tray" style={TRAY_STYLE}>
      <style>{SELLER_CSS}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <p className="sb-display" style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
          Mi lista
        </p>
        <span data-testid="seller-tray-count" className="sb-data" style={CHIP_STYLE}>
          {count === 0 ? "Vacía" : count === 1 ? "1 carta" : `${count} cartas`}
        </span>
        {pricedCount > 0 ? (
          <span data-testid="seller-tray-total" className="sb-data" style={CHIP_STYLE}>
            {formatMoney(sumWantPrices(items), currency)}
          </span>
        ) : null}
        {count > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            style={TOGGLE_STYLE}
          >
            {open ? "Ocultar" : "Ver cartas"}
          </button>
        ) : null}
      </div>

      {open && count > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: "12px 0 0",
            padding: 0,
            maxHeight: "34vh",
            overflowY: "auto",
            display: "grid",
            gap: 6,
          }}
        >
          {items.map((item) => (
            <li
              key={item.pocketCode}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minHeight: 44,
                padding: "6px 10px",
                borderRadius: 12,
                background: "var(--surface-2)",
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.name}
                {item.number ? (
                  <span className="sb-data" style={{ color: "var(--muted)" }}>
                    {" "}
                    #{item.number}
                  </span>
                ) : null}
              </span>
              {item.price ? (
                <span className="sb-data" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  {formatMoney(item.price.amount, item.price.currency)}
                </span>
              ) : null}
              <button
                type="button"
                aria-label={`Quitar ${item.name} de mi lista`}
                onClick={() => remove(item.pocketCode)}
                className="sp-link sp-link-ghost"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginTop: 12,
        }}
      >
        <button
          type="button"
          disabled={count === 0}
          onClick={copyList}
          className="sp-link sp-link-primary"
          style={COPY_STYLE}
        >
          Copiar lista
        </button>
        <SellerContactButtons />
        <span
          aria-live="polite"
          className="sb-data"
          style={{ width: "100%", fontSize: 12, color: "var(--muted)", minHeight: 0 }}
        >
          {feedback}
        </span>
      </div>
    </aside>
  );
}
