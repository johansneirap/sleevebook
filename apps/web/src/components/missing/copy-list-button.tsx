"use client";

import { useEffect, useState } from "react";

export function CopyListButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setFailed(false);
      setCopied(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button type="button" className="sb-miss-btn" onClick={handleCopy}>
        Copiar lista
      </button>
      <span aria-live="polite" className="sb-miss-status">
        {copied ? "Copiada" : failed ? "No se pudo copiar" : ""}
      </span>
    </span>
  );
}
