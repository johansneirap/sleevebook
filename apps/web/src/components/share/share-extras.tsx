"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

export interface ShareExtrasProps {
  slug: string;
  siteUrl: string;
  name: string;
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 11,
  color: "var(--smoke)",
  textTransform: "uppercase",
};

const LINK_STYLE: CSSProperties = {
  fontSize: 13,
  color: "var(--linen)",
  textDecoration: "none",
  borderBottom: "1px solid var(--rule)",
  paddingBottom: 2,
};

const BUTTON_STYLE: CSSProperties = {
  justifySelf: "start",
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  color: "var(--linen)",
  background: "none",
  border: "1px solid var(--rule)",
  borderRadius: 4,
  padding: "6px 14px",
  cursor: "pointer",
};

const SNIPPET_STYLE: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--font-data)",
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--linen)",
  background: "var(--velvet)",
  border: "1px solid var(--rule)",
  borderRadius: 4,
  padding: 10,
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
    <details style={{ display: "grid", gap: 20, minWidth: 0 }}>
      <summary
        className="sb-label"
        style={{ ...LABEL_STYLE, cursor: "pointer", listStyle: "none" }}
      >
        Compartir y embeber
      </summary>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {/* biome-ignore lint/performance/noImgElement: QR is a dynamic route handler response, next/image cannot optimize it */}
        <img
          src={`/s/${slug}/qr`}
          alt={`Código QR de ${name}`}
          width={160}
          height={160}
          style={{ background: "#ffffff", padding: 8, borderRadius: 4, display: "block" }}
        />
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <span className="sb-label" style={LABEL_STYLE}>
            Código QR del binder
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <a href={`/s/${slug}/qr?format=png&download=1`} style={LINK_STYLE}>
              Descargar QR (PNG)
            </a>
            <a href={`/s/${slug}/qr?download=1`} style={LINK_STYLE}>
              Descargar QR (SVG)
            </a>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
        <span className="sb-label" style={LABEL_STYLE}>
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
        <button type="button" onClick={copySnippet} style={BUTTON_STYLE}>
          {copied ? "Copiado" : "Copiar código"}
        </button>
      </div>
    </details>
  );
}
