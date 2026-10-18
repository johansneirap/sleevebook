"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { searchCardVariants } from "../../lib/search";
import { addToWishlist } from "../../lib/wishlist-actions";

/** Catalog search that adds cards to the wishlist (name search, like the binder insert). */
export function WishlistSearch({ listedIds }: { listedIds: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantDisplay[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const listed = new Set([...listedIds, ...addedIds]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSearching(true);
    try {
      setResults(await searchCardVariants(query));
    } catch {
      setError("No pudimos buscar. Intenta de nuevo.");
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd(variantId: string) {
    setError(null);
    setAddingId(variantId);
    try {
      await addToWishlist(variantId);
      setAddedIds((previous) => new Set(previous).add(variantId));
      router.refresh();
    } catch {
      setError("No pudimos agregar la carta. Intenta de nuevo.");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <section aria-labelledby="wishlist-search-title" style={{ display: "grid", gap: 16 }}>
      <h2 id="wishlist-search-title" className="sb-catalog-eyebrow">
        Agregar cartas
      </h2>
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label className="sb-field" style={{ flex: "1 1 240px" }}>
          <span className="sb-field-label">Buscar por nombre</span>
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej. Pikachu"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          className="sb-foil-action"
          disabled={searching}
          style={{ alignSelf: "end" }}
        >
          {searching ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="sb-data"
          style={{ margin: 0, fontSize: 12, color: "var(--foil)" }}
        >
          {error}
        </p>
      )}

      {results !== null &&
        (results.length === 0 ? (
          <p className="sb-catalog-empty" style={{ margin: 0 }}>
            Sin resultados para «{query.trim()}».
          </p>
        ) : (
          <ul
            aria-label="Resultados de búsqueda"
            style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}
          >
            {results.map((display) => {
              const inList = listed.has(display.id);
              return (
                <li
                  key={display.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--rule)",
                  }}
                >
                  {display.imageUrl ? (
                    // biome-ignore lint/performance/noImgElement: catalog thumbnails from external CDNs, sized in CSS
                    <img
                      src={display.imageUrl}
                      alt=""
                      width={40}
                      height={56}
                      loading="lazy"
                      style={{ borderRadius: 3, flexShrink: 0 }}
                    />
                  ) : (
                    <span aria-hidden style={{ width: 40, height: 56, flexShrink: 0 }} />
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", color: "var(--linen)" }}>{display.name}</span>
                    <span
                      className="sb-data"
                      style={{ display: "block", fontSize: 12, color: "var(--smoke)" }}
                    >
                      {display.setName} · {display.number} · {display.variant}
                    </span>
                  </span>
                  {inList ? (
                    <span className="sb-label" style={{ color: "var(--foil)", fontSize: 12 }}>
                      En mis deseos
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="sb-quiet-button"
                      disabled={addingId === display.id}
                      onClick={() => handleAdd(display.id)}
                      aria-label={`Agregar ${display.name} ${display.number} (${display.variant})`}
                    >
                      Agregar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}
