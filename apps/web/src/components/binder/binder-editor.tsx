"use client";

import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import { formatPocketCode } from "@sleevebook/binder-core";
import { useRef, useState, useTransition } from "react";
import type { VariantDisplay } from "../../lib/binders";
import type { PocketContentInput } from "../../lib/pocket-actions";
import { setPocketContent } from "../../lib/pocket-actions";
import { searchCardVariants } from "../../lib/search";

interface BinderEditorProps {
  binderId: string;
  faces: SheetFace[];
  format: Format;
  pockets: Layout["pockets"];
  displays: Record<string, VariantDisplay>;
}

const SEARCH_DEBOUNCE_MS = 300;

export function BinderEditor({ binderId, faces, format, pockets, displays }: BinderEditorProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantDisplay[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function onSearchChange(value: string) {
    setQuery(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      const found = await searchCardVariants(value);
      setResults(found);
      setIsSearching(false);
    }, SEARCH_DEBOUNCE_MS);
  }

  function assign(content: PocketContentInput) {
    if (!selected) {
      return;
    }
    startTransition(async () => {
      await setPocketContent(binderId, selected, content);
      setQuery("");
      setResults([]);
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {faces.map((face) => (
          <section key={`${face.sheet}-${face.side}`}>
            <h2 style={{ fontSize: 14, fontWeight: "normal" }}>
              Hoja {face.sheet} · {face.side === "F" ? "Frente" : "Reverso"}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${format.cols}, 1fr)`,
                gap: 6,
                width: 320,
              }}
            >
              {Array.from({ length: format.rows * format.cols }, (_, i) => {
                const code = formatPocketCode({ sheet: face.sheet, side: face.side, index: i + 1 });
                const content = pockets[code];
                const display =
                  content?.kind === "card" || content?.kind === "placeholder"
                    ? displays[content.variant]
                    : undefined;

                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelected(code)}
                    style={{
                      aspectRatio: "63 / 88",
                      borderWidth: selected === code ? 2 : 1,
                      borderColor: selected === code ? "#06c" : "#ccc",
                      borderStyle: content?.kind === "placeholder" ? "dashed" : "solid",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      padding: 4,
                      background: "white",
                      cursor: "pointer",
                      opacity: !content || content.kind === "empty" ? 0.4 : 1,
                      overflow: "hidden",
                    }}
                  >
                    {content?.kind === "card" && display?.imageUrl ? (
                      // biome-ignore lint/performance/noImgElement: editor MVP, no next/image config yet
                      <img
                        src={display.imageUrl}
                        alt={display.name}
                        style={{ maxWidth: "100%", maxHeight: "100%" }}
                      />
                    ) : display ? (
                      <span>
                        {display.name} {display.number}
                      </span>
                    ) : (
                      <span>{code}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #ccc",
          borderRadius: 4,
          padding: 12,
          maxWidth: 420,
        }}
      >
        {!selected ? (
          <p>Hacé click en un bolsillo para editarlo.</p>
        ) : (
          <>
            <p>
              Editando <strong>{selected}</strong>
            </p>
            <button type="button" disabled={isPending} onClick={() => assign({ kind: "empty" })}>
              Vaciar
            </button>

            <div style={{ marginTop: 8 }}>
              <input
                type="text"
                placeholder="Buscar carta por nombre..."
                value={query}
                onChange={(event) => onSearchChange(event.target.value)}
                style={{ width: "100%" }}
              />
              {isSearching && <p>Buscando...</p>}
              <ul style={{ listStyle: "none", padding: 0 }}>
                {results.map((result) => (
                  <li key={result.id} style={{ marginTop: 4 }}>
                    {result.setName} — {result.name} {result.number} ({result.variant}){" "}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => assign({ kind: "card", variantId: result.id })}
                    >
                      Usar como carta
                    </button>{" "}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        assign({ kind: "placeholder", variantId: result.id, style: "ficha" })
                      }
                    >
                      Usar como placeholder
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
