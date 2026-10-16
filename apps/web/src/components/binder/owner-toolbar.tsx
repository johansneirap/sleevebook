import Link from "next/link";
import type { CSSProperties } from "react";
import { publishBinder, unpublishBinder } from "../../lib/share-actions";

// Owner tools live at the top edge of the page, small and quiet, so the binder
// stays the center of attention. Server component: forms use server actions.

export interface OwnerShareInfo {
  slug: string;
  visibility: string;
  views: number;
}

export interface OwnerToolbarProps {
  binderId: string;
  isPublished: boolean;
  shareInfo: OwnerShareInfo | null;
  siteUrl: string;
  missingHref?: string;
}

const CSS = `
.sb-owner-toolbar a,
.sb-owner-toolbar button {
  color: var(--smoke);
  transition: color 280ms var(--ease-out-expo);
}
.sb-owner-toolbar a:hover,
.sb-owner-toolbar a:focus-visible,
.sb-owner-toolbar button:hover,
.sb-owner-toolbar button:focus-visible {
  color: var(--foil);
}
.sb-owner-toolbar button {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 11px;
  cursor: pointer;
}
.sb-owner-toolbar select {
  font: inherit;
  font-size: 12px;
  color: var(--smoke);
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--rule);
  border-radius: 0;
  padding: 0 2px;
}
@media (prefers-reduced-motion: reduce) {
  .sb-owner-toolbar a,
  .sb-owner-toolbar button {
    transition: none;
  }
}
`;

const ROW: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px 20px",
  fontSize: 12,
  fontFamily: "var(--font-ui)",
  color: "var(--smoke)",
  paddingBottom: 12,
  marginBottom: 36,
  borderBottom: "1px solid color-mix(in srgb, var(--linen) 10%, transparent)",
};

const GROUP: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "6px 14px",
};

const INLINE_FORM: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 10 };

export function OwnerToolbar({
  binderId,
  isPublished,
  shareInfo,
  siteUrl,
  missingHref,
}: OwnerToolbarProps) {
  return (
    <div className="sb-owner-toolbar" style={ROW}>
      <style>{CSS}</style>
      <div style={GROUP}>
        <Link href="/binders">&larr; Mis binders</Link>
        <Link href={`/binders/${binderId}/editar`}>Editar</Link>
        {missingHref && <Link href={missingHref}>Ver lo que falta</Link>}
      </div>

      {isPublished && shareInfo ? (
        <div style={GROUP}>
          <span>
            Publicado ({shareInfo.visibility === "public" ? "público" : "no listado"}) —{" "}
            <a href={`${siteUrl}/s/${shareInfo.slug}`} target="_blank" rel="noreferrer">
              {siteUrl}/s/{shareInfo.slug}
            </a>{" "}
            ({shareInfo.views} vistas)
          </span>
          <form action={publishBinder} style={INLINE_FORM}>
            <input type="hidden" name="binderId" value={binderId} />
            <select aria-label="Visibilidad" name="visibility" defaultValue={shareInfo.visibility}>
              <option value="unlisted">No listado</option>
              <option value="public">Público</option>
            </select>
            <button type="submit">Actualizar</button>
          </form>
          <form action={unpublishBinder} style={INLINE_FORM}>
            <input type="hidden" name="binderId" value={binderId} />
            <button type="submit">Despublicar</button>
          </form>
        </div>
      ) : (
        <form action={publishBinder} style={INLINE_FORM}>
          <input type="hidden" name="binderId" value={binderId} />
          <select aria-label="Visibilidad" name="visibility" defaultValue="unlisted">
            <option value="unlisted">No listado</option>
            <option value="public">Público</option>
          </select>
          <button type="submit">Publicar</button>
        </form>
      )}
    </div>
  );
}
