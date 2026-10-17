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
  width: "min(440px, calc(100vw - 24px))",
  padding: "10px 14px 12px",
  borderRadius: 6,
  background: "var(--velvet-raised)",
  border: "1px solid var(--rule)",
  boxShadow: "0 18px 40px -18px rgba(0, 0, 0, 0.8)",
  color: "var(--linen)",
  fontSize: 13,
};

const LABEL: CSSProperties = { margin: 0, fontSize: 11, color: "var(--smoke)" };

const TOGGLE_STYLE: CSSProperties = {
  marginLeft: "auto",
  background: "none",
  border: 0,
  padding: "2px 0",
  color: "var(--smoke)",
  fontSize: 11,
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
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <p className="sb-label" style={LABEL}>
          Mi lista
        </p>
        <p data-testid="seller-tray-count" className="sb-data" style={{ margin: 0, fontSize: 12 }}>
          {count === 0 ? "Vacía" : count === 1 ? "1 carta" : `${count} cartas`}
        </p>
        {pricedCount > 0 ? (
          <p
            data-testid="seller-tray-total"
            className="sb-data"
            style={{ margin: 0, fontSize: 13, color: "var(--foil)" }}
          >
            {formatMoney(sumWantPrices(items), currency)}
          </p>
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
            margin: "10px 0 0",
            padding: 0,
            maxHeight: "34vh",
            overflowY: "auto",
            borderTop: "1px solid var(--rule)",
          }}
        >
          {items.map((item) => (
            <li
              key={item.pocketCode}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 0",
                borderBottom: "1px solid var(--rule)",
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.name}
                {item.number ? <span className="sb-data"> #{item.number}</span> : null}
              </span>
              {item.price ? (
                <span className="sb-data" style={{ color: "var(--foil)", whiteSpace: "nowrap" }}>
                  {formatMoney(item.price.amount, item.price.currency)}
                </span>
              ) : null}
              <button
                type="button"
                className="sp-link"
                aria-label={`Quitar ${item.name} de mi lista`}
                onClick={() => remove(item.pocketCode)}
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
          gap: "10px 18px",
          marginTop: 10,
        }}
      >
        <button
          type="button"
          className="sp-link"
          disabled={count === 0}
          onClick={copyList}
          style={{ color: "var(--foil)", borderColor: "var(--foil)" }}
        >
          Copiar lista
        </button>
        <SellerContactButtons />
        <span
          aria-live="polite"
          className="sb-data"
          style={{ fontSize: 11, color: "var(--smoke)" }}
        >
          {feedback}
        </span>
      </div>
    </aside>
  );
}
