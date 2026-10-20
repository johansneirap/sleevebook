import Link from "next/link";
import type { CSSProperties } from "react";
import { publishBinder, unpublishBinder } from "../../lib/share-actions";
import { ShareExtras } from "../share/share-extras";

// Owner tools sit in one quiet row above the binder: app buttons for the
// actions, a chip for the publish state. Server component: forms use server actions.

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
  /** Used for the embed snippet's iframe title. */
  binderName: string;
}

const CSS = `
.sb-owner-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--muted);
}
.sb-owner-toolbar .sb-tb-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.sb-owner-toolbar .sb-tb-btn,
.sb-owner-toolbar button.sb-tb-btn,
.sb-owner-toolbar select {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 200ms var(--ease-out-expo), color 200ms var(--ease-out-expo);
}
.sb-owner-toolbar select {
  padding: 0 10px;
}
.sb-owner-toolbar .sb-tb-btn:hover,
.sb-owner-toolbar button.sb-tb-btn:hover,
.sb-owner-toolbar select:hover {
  background: var(--surface-2);
}
.sb-owner-toolbar .sb-tb-btn--primary,
.sb-owner-toolbar button.sb-tb-btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
}
.sb-owner-toolbar .sb-tb-btn--primary:hover,
.sb-owner-toolbar button.sb-tb-btn--primary:hover {
  background: var(--accent-strong);
}
.sb-owner-toolbar .sb-tb-back {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  margin-right: 6px;
  color: var(--muted);
  font-weight: 600;
  text-decoration: none;
}
.sb-owner-toolbar .sb-tb-back:hover {
  color: var(--ink);
}
.sb-owner-toolbar .sb-tb-chip {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  min-height: 32px;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--success-soft);
  color: var(--success);
  font-weight: 600;
}
.sb-owner-toolbar .sb-tb-chip a {
  color: var(--accent);
  font-weight: 600;
}
.sb-owner-toolbar .sb-tb-form {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
}
@media (max-width: 767px) {
  /* Phones: each row scrolls sideways instead of stacking three tall rows. */
  .sb-owner-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .sb-owner-toolbar .sb-tb-group {
    flex-wrap: nowrap;
    overflow-x: auto;
    max-width: 100%;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  .sb-owner-toolbar .sb-tb-group > * {
    flex: 0 0 auto;
  }
  .sb-owner-toolbar .sb-tb-btn,
  .sb-owner-toolbar button.sb-tb-btn,
  .sb-owner-toolbar select,
  .sb-owner-toolbar .sb-tb-back {
    min-height: 44px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sb-owner-toolbar .sb-tb-btn,
  .sb-owner-toolbar button.sb-tb-btn,
  .sb-owner-toolbar select {
    transition: none;
  }
}
`;

const INLINE_FORM: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8 };

export function OwnerToolbar({
  binderId,
  isPublished,
  shareInfo,
  siteUrl,
  missingHref,
  binderName,
}: OwnerToolbarProps) {
  return (
    <div className="sb-owner-toolbar">
      <style>{CSS}</style>
      <div className="sb-tb-group">
        <Link className="sb-tb-back" href="/binders">
          &larr; Mis binders
        </Link>
        <Link className="sb-tb-btn" href={`/binders/${binderId}/editar`}>
          Editar
        </Link>
        {missingHref && (
          <Link className="sb-tb-btn" href={missingHref}>
            Ver lo que falta
          </Link>
        )}
        <Link className="sb-tb-btn" href={`/binders/${binderId}/vender`}>
          Vender
        </Link>
        <Link className="sb-tb-btn" href={`/binders/${binderId}/imprimir`}>
          Imprimir
        </Link>
        <Link className="sb-tb-btn" href={`/binders/${binderId}/plantilla`}>
          Guardar como plantilla
        </Link>
      </div>

      {isPublished && shareInfo ? (
        <div className="sb-tb-group">
          <span className="sb-tb-chip">
            Publicado ({shareInfo.visibility === "public" ? "público" : "no listado"}) —{" "}
            <a href={`${siteUrl}/s/${shareInfo.slug}`} target="_blank" rel="noreferrer">
              {siteUrl}/s/{shareInfo.slug}
            </a>{" "}
            ({shareInfo.views} vistas)
          </span>
          <form action={publishBinder} className="sb-tb-form" style={INLINE_FORM}>
            <input type="hidden" name="binderId" value={binderId} />
            <select aria-label="Visibilidad" name="visibility" defaultValue={shareInfo.visibility}>
              <option value="unlisted">No listado</option>
              <option value="public">Público</option>
            </select>
            <button type="submit" className="sb-tb-btn">
              Actualizar
            </button>
          </form>
          <form action={unpublishBinder} className="sb-tb-form" style={INLINE_FORM}>
            <input type="hidden" name="binderId" value={binderId} />
            <button type="submit" className="sb-tb-btn">
              Despublicar
            </button>
          </form>
          <ShareExtras slug={shareInfo.slug} siteUrl={siteUrl} name={binderName} />
        </div>
      ) : (
        <form action={publishBinder} className="sb-tb-form" style={INLINE_FORM}>
          <input type="hidden" name="binderId" value={binderId} />
          <select aria-label="Visibilidad" name="visibility" defaultValue="unlisted">
            <option value="unlisted">No listado</option>
            <option value="public">Público</option>
          </select>
          <button type="submit" className="sb-tb-btn sb-tb-btn--primary">
            Publicar
          </button>
        </form>
      )}
    </div>
  );
}
