import Link from "next/link";
import type { CSSProperties } from "react";
import { duplicateBinder, renameBinder, setBinderStatus } from "../../lib/binder-actions";
import type { BinderSummary } from "../../lib/binders";
import type { GoalProgress } from "../../lib/goals";
import { DeleteBinderForm } from "../binder/delete-binder-form";

interface BinderCatalogEntryProps {
  binder: BinderSummary;
  index: number;
  cover: string;
  goal: GoalProgress | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

// One binder card: a mini closed binder, name, format, status, goal progress
// and the owner actions (kept as plain forms so they work without JS).
export function BinderCatalogEntry({ binder: b, index, cover, goal }: BinderCatalogEntryProps) {
  const archived = b.status === "archived";
  const statusLabel = STATUS_LABELS[b.status] ?? b.status;
  const statusTone = archived
    ? "sb-chip--warning"
    : b.status === "published"
      ? "sb-chip--accent"
      : "";
  const percentage = goal?.percentage ?? 0;

  return (
    <li
      className="sb-catalog-entry"
      style={{ "--sb-stagger": `${Math.min(index, 12) * 60}ms` } as CSSProperties}
    >
      <div className="sb-catalog-face">
        <div
          className="sb-mini-binder"
          aria-hidden="true"
          style={{ "--sb-cover": cover } as CSSProperties}
        >
          <span className="sb-mini-binder-spine" />
          <span className="sb-mini-binder-stitch" />
          <span className="sb-mini-binder-label" />
        </div>

        <div className="sb-catalog-body">
          <div className="sb-catalog-head">
            <Link href={`/binders/${b.id}`} className="sb-catalog-name">
              {b.name}
            </Link>
            <span className={`sb-chip ${statusTone}`.trim()}>{statusLabel}</span>
          </div>

          <p className="sb-catalog-meta">
            <span className="sb-data">
              {b.formatRows}×{b.formatCols}
            </span>
            <span>{`${b.sheets} hojas`}</span>
          </p>

          {goal ? (
            <div className="sb-catalog-progress">
              <p className="sb-catalog-progress-text">
                <span className="sb-data">{`${goal.owned} de ${goal.total}`}</span> cartas ·{" "}
                <span className="sb-data">{`${percentage}%`}</span>
              </p>
              <div
                className={`sb-progress${percentage >= 100 ? " sb-progress--done" : ""}`}
                role="progressbar"
                aria-label={`Progreso del objetivo de ${b.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentage}
              >
                <span style={{ width: `${Math.min(percentage, 100)}%` }} />
              </div>
            </div>
          ) : null}

          <div className="sb-owner-actions">
            <form action={renameBinder} className="sb-rename">
              <input type="hidden" name="binderId" value={b.id} />
              <input type="text" name="name" aria-label="Nuevo nombre" defaultValue={b.name} />
              <button type="submit" className="sb-quiet-button">
                Renombrar
              </button>
            </form>

            <form action={duplicateBinder}>
              <input type="hidden" name="binderId" value={b.id} />
              <button type="submit" className="sb-quiet-button">
                Duplicar
              </button>
            </form>

            <form action={setBinderStatus}>
              <input type="hidden" name="binderId" value={b.id} />
              <input type="hidden" name="status" value={archived ? "draft" : "archived"} />
              <button type="submit" className="sb-quiet-button">
                {archived ? "Desarchivar" : "Archivar"}
              </button>
            </form>

            <DeleteBinderForm binderId={b.id} />
          </div>
        </div>
      </div>
    </li>
  );
}
