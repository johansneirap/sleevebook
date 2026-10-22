"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteCopies } from "../../lib/collection-actions";
import type { CopyGroupRow } from "./collection-model";
import { CopyDialog } from "./copy-dialog";

// The list of copies. Identical loose copies arrive grouped ("×3"). Selection,
// edit and delete work on copy ids; deletes are confirmed inline (no dialogs
// from window.confirm).

export function CollectionList({ rows }: { rows: CopyGroupRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [confirming, setConfirming] = useState<string | "bulk" | null>(null);
  const [editing, setEditing] = useState<CopyGroupRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.key)), [rows, selected]);
  const selectedIds = selectedRows.flatMap((row) => row.copyIds);

  function toggle(row: CopyGroupRow) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(row.key)) {
        next.delete(row.key);
      } else {
        next.add(row.key);
      }
      return next;
    });
  }

  function remove(ids: string[]) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteCopies(ids);
        setConfirming(null);
        setSelected(new Set());
        router.refresh();
      } catch {
        setError("No pudimos eliminar las copias. Intenta de nuevo.");
      }
    });
  }

  return (
    <>
      <ul className="sb-col-list" aria-label="Copias">
        {rows.map((row) => {
          const isSelected = selected.has(row.key);
          const isConfirming = confirming === row.key;
          return (
            <li key={row.key} className={`sb-col-row${isSelected ? " is-selected" : ""}`}>
              <label className="sb-col-check">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(row)}
                  aria-label={`Seleccionar ${row.name}${row.count > 1 ? ` (${row.count} copias)` : ""}`}
                />
              </label>

              {row.imageUrl ? (
                // biome-ignore lint/performance/noImgElement: catalog CDN images, no optimizer needed
                <img
                  src={row.imageUrl}
                  alt=""
                  width={56}
                  height={78}
                  loading="lazy"
                  className="sb-col-thumb"
                />
              ) : (
                <span className="sb-col-thumb sb-col-thumb--empty" aria-hidden="true" />
              )}

              <div className="sb-col-body">
                <p className="sb-col-name">
                  <span>{row.name}</span>
                  {row.count > 1 ? <span className="sb-col-count">×{row.count}</span> : null}
                </p>
                <p className="sb-col-meta">
                  {[row.setName, row.number, row.variant].filter(Boolean).join(" · ")}
                </p>

                <div className="sb-col-chips">
                  <span className="sb-col-lang" title={row.languageLabel}>
                    {row.chip}
                  </span>
                  <span className="sb-chip">{row.conditionLabel}</span>
                  {row.grading ? (
                    <span className="sb-chip sb-chip--accent">{row.grading}</span>
                  ) : null}
                </div>

                <p className="sb-col-value">
                  <span className="sb-data sb-col-value-amount">{row.valueText}</span>
                  {row.valueHint ? <span className="sb-col-hint">{row.valueHint}</span> : null}
                </p>

                <p className="sb-col-location">
                  {row.placement ? (
                    <>
                      En{" "}
                      <Link href={`/binders/${row.placement.binderId}?spread=0`}>
                        {row.placement.binderName}
                      </Link>{" "}
                      · {row.placement.pocketCode}
                    </>
                  ) : (
                    "Suelta"
                  )}
                </p>

                {row.notes ? <p className="sb-col-notes">{row.notes}</p> : null}

                {isConfirming ? (
                  <div className="sb-col-confirm">
                    <span>¿Eliminar {row.count === 1 ? "esta copia" : `${row.count} copias`}?</span>
                    <button
                      type="button"
                      className="sb-btn sb-btn--danger"
                      onClick={() => remove(row.copyIds)}
                      disabled={pending}
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      className="sb-quiet-button"
                      onClick={() => setConfirming(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <div className="sb-col-actions">
                    <button
                      type="button"
                      className="sb-quiet-button"
                      onClick={() => setEditing(row)}
                    >
                      {row.count > 1 ? "Editar una copia" : "Editar"}
                    </button>
                    <button
                      type="button"
                      className="sb-quiet-button sb-quiet-button--danger"
                      onClick={() => setConfirming(row.key)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {selectedIds.length > 0 ? (
        <section className="sb-col-bulk" aria-label="Acciones de selección">
          {confirming === "bulk" ? (
            <>
              <span className="sb-col-bulk-text">¿Eliminar {selectedIds.length} copias?</span>
              <button
                type="button"
                className="sb-btn sb-btn--danger"
                onClick={() => remove(selectedIds)}
                disabled={pending}
              >
                Sí, eliminar
              </button>
              <button type="button" className="sb-quiet-button" onClick={() => setConfirming(null)}>
                No
              </button>
            </>
          ) : (
            <>
              <span className="sb-col-bulk-text">
                {selectedIds.length} {selectedIds.length === 1 ? "seleccionada" : "seleccionadas"}
              </span>
              <button
                type="button"
                className="sb-btn sb-btn--danger"
                onClick={() => setConfirming("bulk")}
                disabled={pending}
              >
                Eliminar seleccionadas
              </button>
              <button
                type="button"
                className="sb-quiet-button"
                onClick={() => setSelected(new Set())}
              >
                Limpiar
              </button>
            </>
          )}
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="sb-col-error sb-col-error--page">
          {error}
        </p>
      ) : null}

      <CopyDialog
        mode="edit"
        row={editing ?? undefined}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
