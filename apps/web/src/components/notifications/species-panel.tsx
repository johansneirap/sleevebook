"use client";

import { type FormEvent, useId, useState, useTransition } from "react";
import { followSpecies, unfollowSpecies } from "../../lib/notification-actions";

export interface DerivedSpeciesView {
  species: string;
  binderName: string;
}

export interface FollowedSpeciesView {
  id: string;
  species: string;
}

interface SpeciesPanelProps {
  derived: DerivedSpeciesView[];
  followed: FollowedSpeciesView[];
}

// Species that trigger "set nuevo" alerts: derived ones are read-only (they
// come from the goals of your binders); manual ones can be added and removed.
export function SpeciesPanel({ derived, followed }: SpeciesPanelProps) {
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await followSpecies(value);
      if (result.ok) {
        setValue("");
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <section className="sb-avisos-species" aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} className="sb-label sb-avisos-subtitle">
        Especies que sigo
      </h2>

      {derived.length > 0 ? (
        <ul className="sb-avisos-chips" aria-label="Por tus objetivos">
          {derived.map((item) => (
            <li key={`${item.species}-${item.binderName}`} className="sb-avisos-chip">
              <span className="sb-avisos-chip-name">{item.species}</span>
              <span className="sb-avisos-chip-note">por tu objetivo {item.binderName}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {followed.length > 0 ? (
        <ul className="sb-avisos-chips" aria-label="Seguidas a mano">
          {followed.map((item) => (
            <li key={item.id} className="sb-avisos-chip">
              <span className="sb-avisos-chip-name">{item.species}</span>
              <button
                type="button"
                className="sb-quiet-button"
                aria-label={`Dejar de seguir ${item.species}`}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await unfollowSpecies(item.id);
                  })
                }
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {derived.length === 0 && followed.length === 0 ? (
        <p className="sb-avisos-empty-note">
          Aún no sigues ninguna especie. Agrega una para recibir avisos de sets nuevos.
        </p>
      ) : null}

      <form className="sb-avisos-form" onSubmit={onSubmit}>
        <label htmlFor={inputId} className="sb-label sb-avisos-field-label">
          Agregar especie
        </label>
        <div className="sb-avisos-input-row">
          <input
            id={inputId}
            name="species"
            type="text"
            value={value}
            maxLength={60}
            placeholder="Lucario"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setValue(event.target.value)}
          />
          <button
            type="submit"
            className="sb-foil-action"
            disabled={pending || value.trim() === ""}
          >
            Seguir
          </button>
        </div>
        {error ? (
          <p id={errorId} role="alert" className="sb-avisos-error">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
