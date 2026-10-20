"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

export interface ShareExtrasProps {
  slug: string;
  siteUrl: string;
  name: string;
}

const CARD_STYLE: CSSProperties = {
  display: "grid",
  gap: 20,
  minWidth: 0,
  padding: 20,
  borderRadius: "var(--radius-lg)",
  background: "var(--surface)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow)",
  color: "var(--ink)",
};

const SUMMARY_STYLE: CSSProperties = {
  cursor: "pointer",
  listStyle: "none",
  fontSize: 15,
  fontWeight: 700,
  color: "var(--ink)",
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const SUB_LABEL_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--muted)",
};

const LINK_BUTTON_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--accent)",
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
  boxSizing: "border-box",
};

const COPY_BUTTON_STYLE: CSSProperties = {
  justifySelf: "start",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 44,
  padding: "0 18px",
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#fff",
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  boxSizing: "border-box",
};

const SNIPPET_STYLE: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--font-data)",
  fontVariantNumeric: "tabular-nums",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--ink)",
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: 12,
  resize: "vertical",
};

// The snippet lives in an HTML attribute, so the binder name must be escaped.
function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function ShareExtras({ slug, siteUrl, name }: ShareExtrasProps) {
  const [fallbackOrigin, setFallbackOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resetTimer = useRef<number | undefined>(undefined);

  // Without a configured site URL the embed must still be absolute: use the
  // origin this page is served from (only known on the client).
  useEffect(() => {
    if (!siteUrl) {
      setFallbackOrigin(window.location.origin);
    }
  }, [siteUrl]);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const base = (siteUrl || fallbackOrigin).replace(/\/$/, "");
  const snippet = `<iframe src="${base}/e/${slug}" width="100%" height="720" style="border:0" loading="lazy" title="${escapeAttribute(name)} — Sleevebook"></iframe>`;

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (permissions, insecure context): select the
      // text so the owner can copy it by hand.
      textareaRef.current?.select();
    }
  }

  return (
    <details style={CARD_STYLE}>
      <summary className="sb-label" style={SUMMARY_STYLE}>
        Compartir y embeber
      </summary>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {/* biome-ignore lint/performance/noImgElement: QR is a dynamic route handler response, next/image cannot optimize it */}
        <img
          src={`/s/${slug}/qr`}
          alt={`Código QR de ${name}`}
          width={160}
          height={160}
          style={{
            background: "#ffffff",
            padding: 8,
            borderRadius: 16,
            border: "1px solid var(--line)",
            display: "block",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "grid", gap: 12, alignContent: "start", minWidth: 0 }}>
          <span className="sb-label" style={SUB_LABEL_STYLE}>
            Código QR del binder
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <a href={`/s/${slug}/qr?format=png&download=1`} style={LINK_BUTTON_STYLE}>
              Descargar QR (PNG)
            </a>
            <a href={`/s/${slug}/qr?download=1`} style={LINK_BUTTON_STYLE}>
              Descargar QR (SVG)
            </a>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
        <span className="sb-label" style={SUB_LABEL_STYLE}>
          Código para embeber
        </span>
        <textarea
          ref={textareaRef}
          readOnly
          rows={4}
          value={snippet}
          aria-label="Código para embeber el binder"
          onFocus={(event) => event.currentTarget.select()}
          style={SNIPPET_STYLE}
        />
        <button type="button" onClick={copySnippet} style={COPY_BUTTON_STYLE}>
          {copied ? "Copiado" : "Copiar código"}
        </button>
      </div>
    </details>
  );
}
