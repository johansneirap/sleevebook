"use client";

import { type Currency, formatMoney, type ListingStatus } from "@sleevebook/binder-core";
import { useMemo, useState, useTransition } from "react";
import { type ListingChange, saveListings } from "../../lib/seller-actions";
import { CopyChips, type PocketCopy } from "../binder/pocket-copy-badge";
import { type ListingDraft, parsePriceInput, priceToInput, sameDraft } from "./listing-model";

export interface ListingRowData {
  pocketCode: string;
  name: string;
  setName: string;
  number: string;
  imageUrl: string | null;
  /** Fase 7: the physical copy linked to this pocket, if any. */
  copy?: PocketCopy | null;
  /** Price the public page would show without a seller price, in the binder currency. */
  reference: { amount: number; origin: "manual" | "mercado" } | null;
  /** What is stored right now. */
  saved: ListingDraft;
}

export interface ListingsEditorProps {
  binderId: string;
  currency: Currency;
  rows: ListingRowData[];
}

const STATUS_LABELS: Record<ListingStatus, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
};

const STATUS_ORDER: ListingStatus[] = ["disponible", "reservado", "vendido"];

export function ListingsEditor({ binderId, currency, rows }: ListingsEditorProps) {
  const [baseline, setBaseline] = useState<Record<string, ListingDraft>>(() =>
    Object.fromEntries(rows.map((row) => [row.pocketCode, row.saved])),
  );
  const [drafts, setDrafts] = useState<Record<string, ListingDraft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirtyCodes = useMemo(
    () =>
      Object.keys(drafts).filter((code) => {
        const base = baseline[code];
        return base === undefined || !sameDraft(drafts[code] as ListingDraft, base);
      }),
    [drafts, baseline],
  );

  const invalidCodes = dirtyCodes.filter(
    (code) => !parsePriceInput((drafts[code] as ListingDraft).price, currency).ok,
  );

  // Counts and value reflect what is saved, so they never disagree with the public page.
  const counts = useMemo(() => {
    const result: Record<ListingStatus, number> = { disponible: 0, reservado: 0, vendido: 0 };
    let availableValue = 0;
    for (const row of rows) {
      const saved = baseline[row.pocketCode] ?? row.saved;
      result[saved.status] += 1;
      if (saved.status === "disponible") {
        const parsed = parsePriceInput(saved.price, currency);
        const asking = parsed.ok && parsed.value !== null ? parsed.value : null;
        const amount = asking ?? row.reference?.amount ?? null;
        if (amount !== null) {
          availableValue += amount;
        }
      }
    }
    return { ...result, availableValue };
  }, [rows, baseline, currency]);

  function current(code: string, fallback: ListingDraft): ListingDraft {
    return drafts[code] ?? baseline[code] ?? fallback;
  }

  function update(code: string, fallback: ListingDraft, patch: Partial<ListingDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [code]: { ...(prev[code] ?? baseline[code] ?? fallback), ...patch },
    }));
    setMessage(null);
    setSaveError(null);
  }

  function save() {
    const changes: ListingChange[] = dirtyCodes.map((code) => {
      const draft = drafts[code] as ListingDraft;
      return { pocketCode: code, status: draft.status, price: draft.price };
    });
    setErrors({});
    setSaveError(null);
    startTransition(async () => {
      const result = await saveListings(binderId, changes);
      if (!result.ok) {
        setErrors(result.errors);
        setSaveError(result.message);
        return;
      }
      setBaseline((prev) => {
        const next = { ...prev };
        for (const change of changes) {
          const parsed = parsePriceInput(change.price, currency);
          const value = parsed.ok ? parsed.value : null;
          next[change.pocketCode] = {
            status: change.status,
            price: priceToInput(value, currency),
          };
        }
        return next;
      });
      setDrafts({});
      setMessage(result.message);
    });
  }

  const canSave = dirtyCodes.length > 0 && invalidCodes.length === 0 && !pending;

  return (
    <section aria-labelledby="seller-listings-title" className="sb-seller-listings">
      <div className="sb-seller-summary">
        <Figure label="Disponibles" value={String(counts.disponible)} />
        <Figure label="Reservadas" value={String(counts.reservado)} />
        <Figure label="Vendidas" value={String(counts.vendido)} />
        <Figure
          label="Valor disponible"
          value={formatMoney(counts.availableValue, currency)}
          wide
        />
      </div>

      <div className="sb-seller-savebar">
        <p className="sb-seller-savestate" role="status" aria-live="polite">
          {saveError ? (
            <span className="sb-seller-error">{saveError}</span>
          ) : invalidCodes.length > 0 ? (
            <span className="sb-seller-error">
              Corrige los precios marcados para poder guardar.
            </span>
          ) : dirtyCodes.length > 0 ? (
            <span>
              <span className="sb-data">{dirtyCodes.length}</span>{" "}
              {dirtyCodes.length === 1 ? "cambio sin guardar" : "cambios sin guardar"}
            </span>
          ) : (
            <span className="sb-seller-muted">{message ?? "Todo está guardado."}</span>
          )}
        </p>
        <button type="button" className="sb-foil-action" onClick={save} disabled={!canSave}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      <h2 id="seller-listings-title" className="sb-seller-listings-title">
        Cartas
      </h2>

      {rows.length === 0 ? (
        <p className="sb-seller-empty">Este binder todavía no tiene cartas.</p>
      ) : (
        <>
          <div className="sb-seller-head" aria-hidden="true">
            <span>Carta</span>
            <span>Referencia</span>
            <span>Estado</span>
            <span>Precio de venta</span>
          </div>
          <ul className="sb-seller-rows">
            {rows.map((row) => {
              const fallback = row.saved;
              const draft = current(row.pocketCode, fallback);
              const dirty = dirtyCodes.includes(row.pocketCode);
              const priceParse = parsePriceInput(draft.price, currency);
              const priceError = !priceParse.ok
                ? priceParse.error
                : (errors[row.pocketCode] ?? undefined);
              const label = `${row.name} ${row.pocketCode}`;
              return (
                <li
                  key={row.pocketCode}
                  className="sb-seller-row"
                  data-dirty={dirty ? "true" : undefined}
                  data-pocket={row.pocketCode}
                >
                  <div className="sb-seller-card">
                    <span className="sb-seller-thumb">
                      {row.imageUrl ? (
                        // biome-ignore lint/performance/noImgElement: thumbnails are tiny and lazy, no next/image host config for catalog images
                        <img src={row.imageUrl} alt="" width={56} height={78} loading="lazy" />
                      ) : null}
                    </span>
                    <span className="sb-seller-text">
                      <span className="sb-seller-name">{row.name}</span>
                      <span className="sb-seller-meta">
                        {row.setName} · #{row.number}
                      </span>
                      <span className="sb-data sb-seller-code">{row.pocketCode}</span>
                      {row.copy ? <CopyChips copy={row.copy} /> : null}
                    </span>
                  </div>

                  <div className="sb-seller-cell sb-seller-ref">
                    <span className="sb-seller-mini-label">Referencia</span>
                    {row.reference ? (
                      <span>
                        <span className="sb-data">
                          {formatMoney(row.reference.amount, currency)}
                        </span>{" "}
                        <span className="sb-seller-origin">
                          {row.reference.origin === "manual" ? "manual" : "mercado"}
                        </span>
                      </span>
                    ) : (
                      <span className="sb-seller-muted">sin precio</span>
                    )}
                  </div>

                  <label className="sb-seller-cell">
                    <span className="sb-seller-mini-label">Estado</span>
                    <select
                      aria-label={`Estado de ${label}`}
                      value={draft.status}
                      onChange={(event) =>
                        update(row.pocketCode, fallback, {
                          status: event.target.value as ListingStatus,
                        })
                      }
                    >
                      {STATUS_ORDER.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="sb-seller-cell">
                    <span className="sb-seller-mini-label">
                      Precio de venta ({currency.toUpperCase()})
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`Precio de venta de ${label}`}
                      aria-invalid={priceError ? true : undefined}
                      aria-describedby={priceError ? `err-${row.pocketCode}` : undefined}
                      placeholder={
                        row.reference ? formatMoney(row.reference.amount, currency) : "Sin precio"
                      }
                      value={draft.price}
                      onChange={(event) =>
                        update(row.pocketCode, fallback, { price: event.target.value })
                      }
                    />
                    {priceError && (
                      <span id={`err-${row.pocketCode}`} role="alert" className="sb-seller-error">
                        {priceError}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function Figure({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`sb-seller-figure${wide ? " sb-seller-figure-wide" : ""}`}>
      <span className="sb-label sb-seller-figure-label">{label}</span>
      <span className="sb-data sb-seller-figure-value">{value}</span>
    </div>
  );
}
