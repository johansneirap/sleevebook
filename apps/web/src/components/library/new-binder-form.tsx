"use client";

import { useState } from "react";
import { createBinder } from "../../lib/binder-actions";

interface NewBinderFormProps {
  defaultRows: string;
  defaultCols: string;
}

function parseDimension(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Live hint of the chosen format: pockets per sheet, sheets and total cards.
function formatHint(rows: string, cols: string, sheets: string): string {
  const r = parseDimension(rows);
  const c = parseDimension(cols);
  const s = parseDimension(sheets);
  if (r === null || c === null || s === null) {
    return "Revisa filas, columnas y hojas.";
  }
  const perSheet = r * c;
  return `${r}×${c} · ${perSheet} cartas por hoja · ${s} ${s === 1 ? "hoja" : "hojas"} · ${perSheet * s} cartas en total`;
}

export function NewBinderForm({ defaultRows, defaultCols }: NewBinderFormProps) {
  const [rows, setRows] = useState(defaultRows);
  const [cols, setCols] = useState(defaultCols);
  const [sheets, setSheets] = useState("20");

  return (
    <form action={createBinder} style={{ display: "grid", gap: 20, marginTop: 24 }}>
      <label className="sb-field">
        <span className="sb-field-label">Nombre</span>
        <input type="text" name="name" placeholder="Mi binder" required />
      </label>

      <div className="sb-field-grid">
        <label className="sb-field">
          <span className="sb-field-label">Filas</span>
          <input
            type="number"
            name="rows"
            min={1}
            max={6}
            value={rows}
            onChange={(event) => setRows(event.target.value)}
          />
        </label>
        <label className="sb-field">
          <span className="sb-field-label">Columnas</span>
          <input
            type="number"
            name="cols"
            min={1}
            max={6}
            value={cols}
            onChange={(event) => setCols(event.target.value)}
          />
        </label>
        <label className="sb-field">
          <span className="sb-field-label">Hojas</span>
          <input
            type="number"
            name="sheets"
            min={1}
            max={200}
            value={sheets}
            onChange={(event) => setSheets(event.target.value)}
          />
        </label>
      </div>

      <p className="sb-format-hint" aria-live="polite">
        {formatHint(rows, cols, sheets)}
      </p>

      <label className="sb-field">
        <span className="sb-field-label">Apertura</span>
        <select name="opening" defaultValue="side">
          <option value="side">Lateral</option>
          <option value="top">Vertical</option>
        </select>
      </label>

      <div>
        <button type="submit" className="sb-foil-action">
          Crear
        </button>
      </div>
    </form>
  );
}
