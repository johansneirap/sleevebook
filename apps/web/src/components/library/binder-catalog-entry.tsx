import Link from "next/link";
import { duplicateBinder, renameBinder, setBinderStatus } from "../../lib/binder-actions";
import type { BinderSummary } from "../../lib/binders";
import { DeleteBinderForm } from "../binder/delete-binder-form";

interface BinderCatalogEntryProps {
  binder: BinderSummary;
  lot: number;
}

// One lot of the private catalogue: lot number, serif name, small-caps meta,
// and quiet owner actions. Accessible names of the actions are kept as-is.
export function BinderCatalogEntry({ binder: b, lot }: BinderCatalogEntryProps) {
  const archived = b.status === "archived";

  return (
    <li className="sb-catalog-entry" style={{ animationDelay: `${Math.min(lot - 1, 12) * 70}ms` }}>
      <div className="sb-catalog-face">
        <span className="sb-catalog-lot" aria-hidden="true">
          Nº {String(lot).padStart(2, "0")}
        </span>

        <div className="sb-catalog-body">
          <Link href={`/binders/${b.id}`} className="sb-catalog-name">
            {b.name}
          </Link>

          <p className="sb-catalog-meta">
            <span className="sb-data">
              {b.formatRows}×{b.formatCols}
            </span>
            <span>{`${b.sheets} hojas`}</span>
            <span className={archived ? "sb-catalog-status-archived" : undefined}>{b.status}</span>
          </p>

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
