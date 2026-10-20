"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { removeFromWishlist, setWishlistNote, setWishlistTarget } from "../../lib/wishlist-actions";
import "./wishlist.css";

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
    <li className={`sb-wish-row${pending ? " sb-wish-row-pending" : ""}`}>
      {entry.imageUrl ? (
        // biome-ignore lint/performance/noImgElement: catalog thumbnails from external CDNs, sized in CSS
        <img
          src={entry.imageUrl}
          alt=""
          width={56}
          height={78}
          loading="lazy"
          className="sb-wish-thumb"
        />
      ) : (
        <span aria-hidden className="sb-wish-thumb" />
      )}

      <div className="sb-wish-row-head">
        <div className="sb-wish-row-info">
          <p className="sb-wish-row-name">{entry.name}</p>
          <span className="sb-wish-chips">
            <span className="sb-wish-chip">{entry.setName}</span>
            <span className="sb-wish-chip sb-data">{entry.number}</span>
            <span className="sb-wish-chip">{entry.variant}</span>
          </span>
        </div>
        <div className="sb-wish-row-prices">
          <p className={`sb-data sb-wish-price${entry.priceLabel ? "" : " sb-wish-price-missing"}`}>
            {entry.priceLabel ?? "sin precio"}
          </p>
          {typeof entry.cardmarketEur === "number" && (
            <p className="sb-data sb-wish-cardmarket" data-testid="wishlist-cardmarket">
              Cardmarket: {formatCardmarketEur(entry.cardmarketEur)}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="sb-wish-row-form">
        <label htmlFor={targetId} className="sb-wish-field" style={{ width: 160 }}>
          <span className="sb-wish-field-label">Avisarme bajo (US$)</span>
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
        <label htmlFor={noteId} className="sb-wish-field" style={{ flex: "1 1 180px" }}>
          <span className="sb-wish-field-label">Nota</span>
          <input
            id={noteId}
            type="text"
            maxLength={MAX_NOTE_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ej. busco en NM"
          />
        </label>
        <div className="sb-wish-row-actions">
          <button type="submit" className="sb-wish-primary" disabled={pending}>
            Guardar
          </button>
          <button
            type="button"
            className="sb-wish-danger"
            disabled={pending}
            onClick={handleRemove}
            aria-label={`Quitar ${entry.name} ${entry.number} (${entry.variant}) de mis deseos`}
          >
            Quitar
          </button>
        </div>
        {message && (
          <p role="status" className="sb-wish-row-status">
            {message}
          </p>
        )}
      </form>
    </li>
  );
}
