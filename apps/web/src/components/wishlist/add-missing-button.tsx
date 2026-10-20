"use client";

import { useState } from "react";
import { addManyToWishlist } from "../../lib/wishlist-actions";
import "./wishlist.css";

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
    <span className="sb-wish-add-all">
      <button
        type="button"
        className="sb-wish-secondary"
        disabled={pending || variantIds.length === 0}
        onClick={handleClick}
      >
        {pending ? "Agregando…" : "Agregar todo a mis deseos"}
      </button>
      {result && (
        <span role="status" className="sb-wish-add-all-status">
          {result}
        </span>
      )}
    </span>
  );
}
