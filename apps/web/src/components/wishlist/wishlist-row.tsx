"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { removeFromWishlist, setWishlistNote, setWishlistTarget } from "../../lib/wishlist-actions";

export interface WishlistRowData {
  variantId: string;
  name: string;
  number: string;
  variant: string;
  setName: string;
  imageUrl: string | null;
  /** Market price already formatted in the viewer's currency, or null. */
  priceLabel: string | null;
  /** Cardmarket EUR average (raw amount), shown as a quiet second line when present. */
  cardmarketEur?: number | null;
  targetPriceUsd: number | null;
  note: string | null;
}

const MAX_TARGET_USD = 100000;
const MAX_NOTE_LENGTH = 140;

const EUR_FORMAT = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "12,30 €": Cardmarket shows euros with a decimal comma. */
export function formatCardmarketEur(amount: number): string {
  return `${EUR_FORMAT.format(amount)} €`;
}

/** One wishlist entry: thumbnail, price, USD price alert and note. */
export function WishlistRow({ entry }: { entry: WishlistRowData }) {
  const router = useRouter();
  const [target, setTarget] = useState(
    entry.targetPriceUsd === null ? "" : entry.targetPriceUsd.toFixed(2),
  );
  const [note, setNote] = useState(entry.note ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = target.trim().replace(",", ".");
    let targetValue: number | null = null;
    if (raw !== "") {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_TARGET_USD) {
        setMessage(`Precio entre 0 y ${MAX_TARGET_USD.toLocaleString("en-US")} USD`);
        return;
      }
      targetValue = Math.round(parsed * 100) / 100;
    }
    if (note.trim().length > MAX_NOTE_LENGTH) {
      setMessage(`La nota no puede superar ${MAX_NOTE_LENGTH} caracteres`);
      return;
    }
    startTransition(async () => {
      setMessage(null);
      try {
        await setWishlistTarget(entry.variantId, targetValue);
        await setWishlistNote(entry.variantId, note);
        setMessage("Guardado");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No pudimos guardar");
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeFromWishlist(entry.variantId);
        router.refresh();
      } catch {
        setMessage("No pudimos quitar la carta");
      }
    });
  }

  const targetId = `target-${entry.variantId}`;
  const noteId = `note-${entry.variantId}`;

  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: "14px 18px",
        padding: "18px 0",
        borderBottom: "1px solid var(--rule)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {entry.imageUrl ? (
        // biome-ignore lint/performance/noImgElement: catalog thumbnails from external CDNs, sized in CSS
        <img
          src={entry.imageUrl}
          alt=""
          width={72}
          height={100}
          loading="lazy"
          style={{ borderRadius: 4, gridRow: "span 2" }}
        />
      ) : (
        <span aria-hidden style={{ width: 72, height: 100, gridRow: "span 2" }} />
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 24px",
          alignItems: "baseline",
          justifyContent: "space-between",
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p className="sb-display" style={{ margin: 0, fontSize: 22, color: "var(--linen)" }}>
            {entry.name}
          </p>
          <p className="sb-data" style={{ margin: "4px 0 0", fontSize: 12, color: "var(--smoke)" }}>
            {entry.setName} · {entry.number} · {entry.variant}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p
            className="sb-data"
            style={{
              margin: 0,
              fontSize: 15,
              color: entry.priceLabel ? "var(--linen)" : "var(--smoke)",
            }}
          >
            {entry.priceLabel ?? "sin precio"}
          </p>
          {typeof entry.cardmarketEur === "number" && (
            <p
              className="sb-data"
              data-testid="wishlist-cardmarket"
              style={{ margin: "2px 0 0", fontSize: 12, color: "var(--smoke)" }}
            >
              Cardmarket: {formatCardmarketEur(entry.cardmarketEur)}
            </p>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSave}
        style={{
          gridColumn: "2",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px 16px",
          alignItems: "flex-end",
        }}
      >
        <label htmlFor={targetId} className="sb-field" style={{ width: 150 }}>
          <span className="sb-field-label">Avisarme bajo (US$)</span>
          <input
            id={targetId}
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_TARGET_USD}
            step="0.01"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="Sin aviso"
          />
        </label>
        <label htmlFor={noteId} className="sb-field" style={{ flex: "1 1 180px", minWidth: 0 }}>
          <span className="sb-field-label">Nota</span>
          <input
            id={noteId}
            type="text"
            maxLength={MAX_NOTE_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ej. busco en NM"
          />
        </label>
        <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
          <button
            type="submit"
            className="sb-quiet-button"
            disabled={pending}
            style={{ color: "var(--foil)" }}
          >
            Guardar
          </button>
          <button
            type="button"
            className="sb-quiet-button"
            disabled={pending}
            onClick={handleRemove}
            aria-label={`Quitar ${entry.name} ${entry.number} (${entry.variant}) de mis deseos`}
          >
            Quitar
          </button>
        </div>
        {message && (
          <p
            role="status"
            className="sb-data"
            style={{ margin: 0, width: "100%", fontSize: 12, color: "var(--smoke)" }}
          >
            {message}
          </p>
        )}
      </form>
    </li>
  );
}
