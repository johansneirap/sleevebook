"use client";

import {
  COPY_CONDITIONS,
  COPY_LANGUAGES,
  type CopyInput,
  GRADING_COMPANIES,
} from "@sleevebook/binder-core";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { createCopies, updateCopy } from "../../lib/collection-actions";
import { searchCardVariants } from "../../lib/search";
import type { CopyFormValues, CopyGroupRow } from "./collection-model";

// "Agregar copias" (add mode: pick a catalog card, then the copy fields) and
// "Editar copia" (edit mode: the card is fixed). Native <dialog>: a centered
// modal on desktop, a bottom sheet on phones (see collection.css).

const GRADE_OPTIONS = Array.from({ length: 19 }, (_, i) => String(1 + i * 0.5));
const EMPTY_FORM: CopyFormValues = {
  id: "",
  variantId: "",
  language: "en",
  condition: "NM",
  gradingCompany: "",
  gradingGrade: "",
  purchasePrice: "",
  purchaseCurrency: "usd",
  valueUsd: "",
  notes: "",
  acquiredAt: "",
};

export interface CopyDialogProps {
  mode: "add" | "edit";
  open: boolean;
  onClose: () => void;
  /** Edit mode: the group whose first copy is edited. */
  row?: CopyGroupRow;
}

export function CopyDialog({ mode, open, onClose, row }: CopyDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog ref={ref} className="sb-col-dialog" aria-labelledby={titleId} onClose={onClose}>
      {open ? <DialogBody titleId={titleId} mode={mode} row={row} onClose={onClose} /> : null}
    </dialog>
  );
}

function DialogBody({
  titleId,
  mode,
  row,
  onClose,
}: {
  titleId: string;
  mode: "add" | "edit";
  row?: CopyGroupRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const idPrefix = useId();
  const initial: CopyFormValues = mode === "edit" && row ? row.form : EMPTY_FORM;

  const [variant, setVariant] = useState<VariantDisplay | null>(null);
  const [fields, setFields] = useState<CopyFormValues>(initial);
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = mode === "edit";
  const shownCard =
    editing && row
      ? {
          name: row.name,
          setName: row.setName,
          number: row.number,
          variant: row.variant,
          imageUrl: row.imageUrl,
        }
      : variant;
  const ready = editing || variant !== null;

  function set<K extends keyof CopyFormValues>(key: K, value: CopyFormValues[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const built = buildInput(
      editing
        ? { ...fields, variantId: row?.form.variantId ?? "" }
        : { ...fields, variantId: variant?.id ?? "" },
    );
    if (typeof built === "string") {
      setError(built);
      return;
    }
    setSaving(true);
    try {
      if (editing && row) {
        await updateCopy(row.form.id, built);
      } else {
        const count = Number(quantity);
        if (!Number.isInteger(count) || count < 1 || count > 50) {
          setError("La cantidad va de 1 a 50.");
          setSaving(false);
          return;
        }
        await createCopies(built, count);
      }
      router.refresh();
      onClose();
    } catch {
      setError("No pudimos guardar la copia. Revisa los datos e intenta de nuevo.");
      setSaving(false);
    }
  }

  return (
    <form className="sb-col-dialog-form" onSubmit={handleSubmit} noValidate>
      <div className="sb-col-dialog-head">
        <h2 id={titleId} className="sb-col-dialog-title">
          {editing ? "Editar copia" : "Agregar copias"}
        </h2>
        <button type="button" className="sb-col-icon-button" onClick={onClose} aria-label="Cerrar">
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {!editing && variant === null ? (
        <VariantSearch onPick={setVariant} />
      ) : (
        <div className="sb-col-picked">
          {shownCard?.imageUrl ? (
            // biome-ignore lint/performance/noImgElement: catalog CDN images, no optimizer needed
            <img src={shownCard.imageUrl} alt="" width={48} height={67} className="sb-col-thumb" />
          ) : (
            <span className="sb-col-thumb sb-col-thumb--empty" aria-hidden="true" />
          )}
          <div className="sb-col-picked-text">
            <p className="sb-col-picked-name">{shownCard?.name}</p>
            <p className="sb-col-picked-meta">
              {[shownCard?.setName, shownCard?.number, shownCard?.variant]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {!editing ? (
            <button type="button" className="sb-quiet-button" onClick={() => setVariant(null)}>
              Cambiar
            </button>
          ) : null}
        </div>
      )}

      {ready ? (
        <div className="sb-col-fields">
          {!editing ? (
            <label className="sb-field">
              <span className="sb-field-label">Cantidad</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
          ) : null}

          <label className="sb-field">
            <span className="sb-field-label">Idioma</span>
            <select
              value={fields.language}
              onChange={(event) => set("language", event.target.value)}
            >
              {COPY_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>

          <label className="sb-field">
            <span className="sb-field-label">Condición</span>
            <select
              value={fields.condition}
              onChange={(event) => set("condition", event.target.value)}
            >
              {COPY_CONDITIONS.map((condition) => (
                <option key={condition.code} value={condition.code}>
                  {condition.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="sb-col-group sb-col-fieldset">
            <legend className="sb-field-label">Gradeo (opcional)</legend>
            <div className="sb-col-grade-row">
              <label className="sb-field">
                <span className="sb-field-label">Empresa</span>
                <select
                  value={fields.gradingCompany}
                  onChange={(event) => set("gradingCompany", event.target.value)}
                >
                  <option value="">Sin gradeo</option>
                  {GRADING_COMPANIES.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sb-field">
                <span className="sb-field-label">Nota</span>
                <select
                  value={fields.gradingGrade}
                  aria-label="Nota del gradeo"
                  disabled={fields.gradingCompany === ""}
                  onChange={(event) => set("gradingGrade", event.target.value)}
                >
                  <option value="">Elige nota</option>
                  {GRADE_OPTIONS.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="sb-col-fieldset">
            <legend className="sb-field-label">Compra y valor (opcional)</legend>
            <div className="sb-col-grade-row">
              <label className="sb-field">
                <span className="sb-field-label">Precio de compra</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={fields.purchasePrice}
                  onChange={(event) => set("purchasePrice", event.target.value)}
                />
              </label>
              <label className="sb-field">
                <span className="sb-field-label">Moneda</span>
                <select
                  value={fields.purchaseCurrency}
                  onChange={(event) => set("purchaseCurrency", event.target.value)}
                >
                  <option value="usd">USD</option>
                  <option value="clp">CLP</option>
                  <option value="eur">EUR</option>
                </select>
              </label>
            </div>
            <label className="sb-field">
              <span className="sb-field-label">Valor propio en USD</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={fields.valueUsd}
                onChange={(event) => set("valueUsd", event.target.value)}
              />
              <span className="sb-col-field-hint">
                Si lo dejas vacío, estimamos el valor por la condición.
              </span>
            </label>
            <label className="sb-field">
              <span className="sb-field-label">Fecha de adquisición</span>
              <input
                type="date"
                value={fields.acquiredAt}
                onChange={(event) => set("acquiredAt", event.target.value)}
              />
            </label>
          </fieldset>

          <label className="sb-field" htmlFor={`${idPrefix}-notes`}>
            <span className="sb-field-label">Notas</span>
            <textarea
              id={`${idPrefix}-notes`}
              rows={2}
              maxLength={500}
              value={fields.notes}
              onChange={(event) => set("notes", event.target.value)}
              className="sb-col-textarea"
            />
          </label>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="sb-col-error">
          {error}
        </p>
      ) : null}

      <div className="sb-col-dialog-actions">
        <button type="button" className="sb-btn sb-btn--secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="sb-btn sb-btn--primary" disabled={!ready || saving}>
          {saving ? "Guardando…" : editing ? "Guardar cambios" : "Agregar copias"}
        </button>
      </div>
    </form>
  );
}

/** Returns the server input, or a Spanish message when a field is invalid. */
function buildInput(values: CopyFormValues & { variantId: string }): CopyInput | string {
  if (values.gradingCompany !== "" && values.gradingGrade === "") {
    return "Elige la nota del gradeo.";
  }
  if (values.gradingCompany === "" && values.gradingGrade !== "") {
    return "Elige la empresa del gradeo, o quita la nota.";
  }
  const price = values.purchasePrice === "" ? null : Number(values.purchasePrice);
  const value = values.valueUsd === "" ? null : Number(values.valueUsd);
  if (
    (price !== null && (!Number.isFinite(price) || price < 0)) ||
    (value !== null && (!Number.isFinite(value) || value < 0))
  ) {
    return "Los precios no pueden ser negativos.";
  }
  return {
    variantId: values.variantId,
    language: values.language as CopyInput["language"],
    condition: values.condition as CopyInput["condition"],
    gradingCompany:
      values.gradingCompany === "" ? null : (values.gradingCompany as CopyInput["gradingCompany"]),
    gradingGrade: values.gradingCompany === "" ? null : Number(values.gradingGrade),
    purchasePrice: price,
    purchaseCurrency: values.purchaseCurrency as CopyInput["purchaseCurrency"],
    valueUsd: value,
    notes: values.notes.trim() === "" ? null : values.notes.trim(),
    acquiredAt: values.acquiredAt === "" ? null : values.acquiredAt,
  };
}

/** Debounced catalog search; picking a result hands it to the parent. */
function VariantSearch({ onPick }: { onPick: (variant: VariantDisplay) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantDisplay[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchCardVariants(term)
        .then((found) => {
          if (active) {
            setResults(found);
            setFailed(false);
          }
        })
        .catch(() => {
          if (active) {
            setFailed(true);
          }
        })
        .finally(() => {
          if (active) {
            setSearching(false);
          }
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="sb-col-search">
      <label className="sb-field">
        <span className="sb-field-label">Busca la carta por nombre</span>
        <input
          type="search"
          name="q"
          autoComplete="off"
          placeholder="Ej: Pikachu"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {failed ? <p className="sb-col-error">No pudimos buscar. Intenta de nuevo.</p> : null}
      {searching ? <p className="sb-col-field-hint">Buscando…</p> : null}
      {!searching && query.trim().length >= 2 && results.length === 0 && !failed ? (
        <p className="sb-col-field-hint">No encontramos cartas con ese nombre.</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="sb-col-results">
          {results.map((found) => (
            <li key={found.id}>
              <button type="button" className="sb-col-result" onClick={() => onPick(found)}>
                {found.imageUrl ? (
                  // biome-ignore lint/performance/noImgElement: catalog CDN images, no optimizer needed
                  <img
                    src={found.imageUrl}
                    alt=""
                    width={36}
                    height={50}
                    className="sb-col-thumb"
                  />
                ) : (
                  <span className="sb-col-thumb sb-col-thumb--empty" aria-hidden="true" />
                )}
                <span className="sb-col-result-text">
                  <span className="sb-col-result-name">{found.name}</span>
                  <span className="sb-col-result-meta">
                    {found.setName} · {found.number} · {found.variant}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
