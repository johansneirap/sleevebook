"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import type { CollectionFilters as Filters } from "./collection-model";

// Filters live in the URL (GET form), so they survive reloads and can be
// shared. Selects submit on change; the search box submits on Enter.

interface Option {
  code: string;
  label: string;
}

export function CollectionFilters({
  filters,
  languages,
  conditions,
}: {
  filters: Filters;
  languages: Option[];
  conditions: Option[];
}) {
  const active = Boolean(filters.language || filters.condition || filters.graded || filters.where);
  // Phones: the selects fold behind a toggle so the list starts near the top.
  const [open, setOpen] = useState(active);

  function submitOnChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target as HTMLElement;
    if (target.tagName === "SELECT") {
      event.currentTarget.requestSubmit();
    }
  }

  return (
    <form method="get" action="/coleccion" className="sb-col-filters" onChange={submitOnChange}>
      <label className="sb-field sb-col-filter-search">
        <span className="sb-field-label">Buscar por nombre o set</span>
        <input type="search" name="q" defaultValue={filters.q} placeholder="Ej: Charizard" />
      </label>
      <button
        type="button"
        className="sb-quiet-button sb-col-filter-toggle"
        aria-expanded={open}
        aria-controls="sb-col-filter-more"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Ocultar filtros" : active ? "Filtros (activos)" : "Filtros y orden"}
      </button>
      <div id="sb-col-filter-more" className="sb-col-filter-more" data-open={open}>
        <label className="sb-field">
          <span className="sb-field-label">Idioma</span>
          <select name="lang" defaultValue={filters.language}>
            <option value="">Todos</option>
            {languages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
        <label className="sb-field">
          <span className="sb-field-label">Condición</span>
          <select name="cond" defaultValue={filters.condition}>
            <option value="">Todas</option>
            {conditions.map((condition) => (
              <option key={condition.code} value={condition.code}>
                {condition.label}
              </option>
            ))}
          </select>
        </label>
        <label className="sb-field">
          <span className="sb-field-label">Gradeo</span>
          <select name="graded" defaultValue={filters.graded}>
            <option value="">Todas</option>
            <option value="si">Gradeadas</option>
            <option value="no">Sin gradear</option>
          </select>
        </label>
        <label className="sb-field">
          <span className="sb-field-label">Ubicación</span>
          <select name="where" defaultValue={filters.where}>
            <option value="">Todas</option>
            <option value="binder">En un binder</option>
            <option value="loose">Sueltas</option>
          </select>
        </label>
        <label className="sb-field">
          <span className="sb-field-label">Ordenar por</span>
          <select name="sort" defaultValue={filters.sort}>
            <option value="recientes">Recientes</option>
            <option value="nombre">Nombre</option>
            <option value="valor">Valor</option>
          </select>
        </label>
      </div>
      <div className="sb-col-filter-actions">
        <button type="submit" className="sb-btn sb-btn--secondary">
          Buscar
        </button>
        {active || filters.q ? (
          <Link href="/coleccion" className="sb-quiet-button">
            Limpiar filtros
          </Link>
        ) : null}
      </div>
    </form>
  );
}
