"use client";

import {
  COPY_CONDITIONS,
  COPY_LANGUAGES,
  type CopyCondition,
  type CopyLanguage,
  DEFAULT_COPY_CONDITION,
  DEFAULT_COPY_LANGUAGE,
  GRADING_COMPANIES,
  type GradingCompany,
  languageChip,
} from "@sleevebook/binder-core";
import { useState } from "react";

// Fase 7: the "Copia" block of the editor inspector, for one selected card
// pocket. Presentational: the editor owns the data and the server calls.
// Styles live in the editor's EDITOR_CSS (classes prefixed sb-ed-).

export interface CopyOption {
  id: string;
  language: string;
  condition: string;
  /** "PSA 10"; null when raw. */
  grading: string | null;
}

export interface CopyCandidate extends CopyOption {
  /** "Suelta" or "En <binder> · <code>". */
  location: string;
}

export interface NewCopyInput {
  language: CopyLanguage;
  condition: CopyCondition;
  gradingCompany: GradingCompany | null;
  gradingGrade: number | null;
}

interface CopySectionProps {
  linked: CopyOption | null;
  candidates: CopyCandidate[];
  /** Set when the picked copy sits in another pocket and needs a yes. */
  pendingMove: { location: string } | null;
  busy: boolean;
  error: string | null;
  onPick: (copyId: string) => void;
  onConfirmMove: () => void;
  onCancelMove: () => void;
  onUnlink: () => void;
  onCreate: (input: NewCopyInput) => Promise<void>;
}

type View = "summary" | "pick" | "new";

// Half steps from 1 to 10, as the schema accepts.
const GRADE_VALUES = Array.from({ length: 19 }, (_, i) => String(1 + i * 0.5));

export function CopySection({
  linked,
  candidates,
  pendingMove,
  busy,
  error,
  onPick,
  onConfirmMove,
  onCancelMove,
  onUnlink,
  onCreate,
}: CopySectionProps) {
  const [view, setView] = useState<View>("summary");
  const [language, setLanguage] = useState<CopyLanguage>(DEFAULT_COPY_LANGUAGE);
  const [condition, setCondition] = useState<CopyCondition>(DEFAULT_COPY_CONDITION);
  const [company, setCompany] = useState<GradingCompany | "">("");
  const [grade, setGrade] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function submitNew() {
    setFormError(null);
    // Grading is both or none: a company without a grade (or the reverse) is refused.
    if ((company === "") !== (grade === "")) {
      setFormError("Para una copia gradeada indica empresa y nota. Si no, deja ambas vacías.");
      return;
    }
    void onCreate({
      language,
      condition,
      gradingCompany: company === "" ? null : company,
      gradingGrade: grade === "" ? null : Number(grade),
    });
  }

  return (
    <div className="sb-ed-copy">
      <p className="sb-ed-copy-title">Copia</p>

      {linked && (
        <div className="sb-ed-copy-tags">
          <span className="sb-ed-chip">{languageChip(linked.language)}</span>
          <span className="sb-ed-chip">{linked.condition}</span>
          {linked.grading && <span className="sb-ed-chip">{linked.grading}</span>}
        </div>
      )}

      {!linked && view === "summary" && <p className="sb-ed-note">Sin copia asignada</p>}

      {view === "summary" && (
        <div className="sb-ed-row">
          <button
            type="button"
            className="sb-ed-btn"
            disabled={busy}
            onClick={() => setView("pick")}
          >
            {linked ? "Cambiar copia" : "Elegir copia"}
          </button>
          {linked ? (
            <button
              type="button"
              className="sb-ed-btn sb-ed-btn-danger"
              disabled={busy}
              onClick={onUnlink}
            >
              Quitar copia
            </button>
          ) : (
            <button
              type="button"
              className="sb-ed-btn sb-ed-btn-primary"
              disabled={busy}
              onClick={() => setView("new")}
            >
              Nueva copia
            </button>
          )}
        </div>
      )}

      {pendingMove && (
        <div className="sb-ed-copy-ask" role="alert">
          <p className="sb-ed-note">Esta copia está en {pendingMove.location}. ¿Moverla aquí?</p>
          <div className="sb-ed-row">
            <button
              type="button"
              className="sb-ed-btn sb-ed-btn-primary"
              disabled={busy}
              onClick={onConfirmMove}
            >
              Mover aquí
            </button>
            <button type="button" className="sb-ed-btn" disabled={busy} onClick={onCancelMove}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {view === "pick" && (
        <div className="sb-ed-copy-pick">
          <p className="sb-ed-note">Tus copias de esta carta</p>
          {candidates.length === 0 ? (
            <p className="sb-ed-note">No tienes otras copias de esta carta.</p>
          ) : (
            <ul className="sb-ed-list">
              {candidates.map((copy) => (
                <li key={copy.id} className="sb-ed-line">
                  <span className="sb-ed-chip">{languageChip(copy.language)}</span>
                  <span className="sb-ed-num">{copy.condition}</span>
                  {copy.grading && <span className="sb-ed-chip">{copy.grading}</span>}
                  <span className="sb-ed-copy-where">{copy.location}</span>
                  <button
                    type="button"
                    className="sb-ed-btn"
                    disabled={busy}
                    onClick={() => onPick(copy.id)}
                  >
                    Usar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="sb-ed-row">
            <button type="button" className="sb-ed-btn" onClick={() => setView("summary")}>
              Volver
            </button>
          </div>
        </div>
      )}

      {view === "new" && (
        <form
          className="sb-ed-copy-new"
          onSubmit={(event) => {
            event.preventDefault();
            submitNew();
          }}
        >
          <div className="sb-ed-row">
            <label className="sb-ed-field">
              <span>Idioma</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as CopyLanguage)}
              >
                {COPY_LANGUAGES.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="sb-ed-field">
              <span>Condición</span>
              <select
                value={condition}
                onChange={(event) => setCondition(event.target.value as CopyCondition)}
              >
                {COPY_CONDITIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="sb-ed-row">
            <label className="sb-ed-field">
              <span>Gradeo</span>
              <select
                value={company}
                onChange={(event) => setCompany(event.target.value as GradingCompany | "")}
              >
                <option value="">Sin gradeo</option>
                {GRADING_COMPANIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="sb-ed-field">
              <span>Nota</span>
              <select value={grade} onChange={(event) => setGrade(event.target.value)}>
                <option value="">Sin nota</option>
                {GRADE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {formError && <p className="sb-ed-error">{formError}</p>}
          <div className="sb-ed-row">
            <button type="submit" className="sb-ed-btn sb-ed-btn-primary" disabled={busy}>
              Crear y asignar
            </button>
            <button type="button" className="sb-ed-btn" onClick={() => setView("summary")}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && <p className="sb-ed-error">{error}</p>}
    </div>
  );
}
