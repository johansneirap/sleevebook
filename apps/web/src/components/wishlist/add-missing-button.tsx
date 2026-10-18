"use client";

import { useState } from "react";
import { addManyToWishlist } from "../../lib/wishlist-actions";

const CHUNK_SIZE = 500;

/** "Me faltan": adds every missing variant to the viewer's wishlist. */
export function AddMissingToWishlistButton({ variantIds }: { variantIds: string[] }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setResult(null);
    try {
      let added = 0;
      for (let start = 0; start < variantIds.length; start += CHUNK_SIZE) {
        const chunk = variantIds.slice(start, start + CHUNK_SIZE);
        const response = await addManyToWishlist(chunk);
        added += response.added;
      }
      setResult(
        added === 0
          ? "Ya estaban todas en tu lista"
          : `${added} ${added === 1 ? "carta agregada" : "cartas agregadas"}`,
      );
    } catch {
      setResult("No pudimos agregarlas. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span
      style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "baseline", gap: "6px 12px" }}
    >
      <button
        type="button"
        className="sb-quiet-button"
        disabled={pending || variantIds.length === 0}
        onClick={handleClick}
        style={{ color: "var(--foil)" }}
      >
        {pending ? "Agregando…" : "Agregar todo a mis deseos"}
      </button>
      {result && (
        <span role="status" className="sb-data" style={{ fontSize: 12, color: "var(--smoke)" }}>
          {result}
        </span>
      )}
    </span>
  );
}
