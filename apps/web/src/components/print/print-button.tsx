"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 44,
        padding: "0 20px",
        borderRadius: 12,
        border: "1px solid var(--accent)",
        background: "var(--accent)",
        color: "#ffffff",
        fontFamily: "var(--font-ui)",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      Imprimir / Guardar como PDF
    </button>
  );
}
