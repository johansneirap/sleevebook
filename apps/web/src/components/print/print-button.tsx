"use client";

export function PrintButton() {
  return (
    <button type="button" className="sb-foil-action" onClick={() => window.print()}>
      Imprimir / Guardar como PDF
    </button>
  );
}
