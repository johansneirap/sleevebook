import { COPY_CONDITIONS, COPY_LANGUAGES } from "@sleevebook/binder-core";
import Link from "next/link";
import { AddCopiesButton } from "../../components/collection/add-copies-button";
import { CollectionFilters } from "../../components/collection/collection-filters";
import { CollectionList } from "../../components/collection/collection-list";
import {
  buildGroupRows,
  filterEntries,
  parseFilters,
} from "../../components/collection/collection-model";
import { CreateCopiesButton, UnlinkedCallout } from "../../components/collection/unlinked-callout";
import { SiteNav } from "../../components/site/site-nav";
import { getCollection } from "../../lib/collection";
import { requireUser } from "../../lib/session";
import { getViewerPriceFormatter } from "../../lib/viewer-money";
import "../../components/library/catalog.css";
import "../../components/collection/collection.css";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ColeccionPage({ searchParams }: PageProps) {
  const viewer = await requireUser("/coleccion");
  const [collection, money, params] = await Promise.all([
    getCollection(viewer.id),
    getViewerPriceFormatter(viewer.id),
    searchParams,
  ]);
  const { entries, totalUsd, unlinkedPockets } = collection;

  const filters = parseFilters(params);
  const filtered = filterEntries(entries, filters);
  const rows = buildGroupRows(filtered, filters, money.formatUsd);
  const anyValued = entries.some((entry) => entry.value !== undefined);
  const totalText = money.formatUsd(anyValued ? totalUsd : null);
  const distinctCards = new Set(entries.map((entry) => entry.copy.variantId)).size;
  const copyCount = entries.length;
  const usedLanguages = COPY_LANGUAGES.filter((l) =>
    entries.some((entry) => entry.copy.language === l.code),
  );
  const filtersActive =
    filters.q !== "" ||
    filters.language !== "" ||
    filters.condition !== "" ||
    filters.graded !== "" ||
    filters.where !== "";

  return (
    <>
      <SiteNav current="/coleccion" />
      <main className="sb-catalog-page sb-col-page">
        <header className="sb-col-header">
          <div>
            <p className="sb-catalog-eyebrow">
              {copyCount} {copyCount === 1 ? "copia" : "copias"} · {distinctCards}{" "}
              {distinctCards === 1 ? "carta" : "cartas distintas"}
            </p>
            <h1 className="sb-catalog-title">Mi colección</h1>
            {copyCount > 0 ? (
              <p className="sb-col-value">
                <span className="sb-label">Valor estimado</span>{" "}
                <span className="sb-data sb-col-value-amount">{totalText}</span>
              </p>
            ) : null}
          </div>
          <div className="sb-col-header-actions">
            {copyCount > 0 ? <AddCopiesButton /> : null}
            {copyCount > 0 ? (
              <a href="/coleccion/exportar" className="sb-btn sb-btn--secondary">
                Exportar CSV
              </a>
            ) : null}
          </div>
        </header>

        {unlinkedPockets > 0 && copyCount > 0 ? <UnlinkedCallout count={unlinkedPockets} /> : null}

        {copyCount === 0 ? (
          <section className="sb-col-empty" aria-labelledby="col-empty-title">
            <h2 id="col-empty-title" className="sb-col-empty-title">
              Todavía no tienes copias registradas
            </h2>
            <p className="sb-col-empty-text">
              Una copia es una carta física que tienes: con su idioma, su condición y, si la
              gradeaste, su nota. Cada copia puede estar en un binder o suelta.
            </p>
            <div className="sb-col-empty-actions">
              <AddCopiesButton />
              <CreateCopiesButton />
            </div>
          </section>
        ) : (
          <>
            <CollectionFilters
              filters={filters}
              languages={usedLanguages.map((l) => ({ code: l.code, label: l.label }))}
              conditions={COPY_CONDITIONS.map((c) => ({ code: c.code, label: c.label }))}
            />
            <p className="sb-col-result-count" aria-live="polite">
              {filtersActive
                ? `${rows.length} de ${copyCount} ${copyCount === 1 ? "copia" : "copias"}`
                : null}
            </p>
            {rows.length === 0 ? (
              <p className="sb-catalog-empty">Ninguna copia coincide con los filtros.</p>
            ) : (
              <CollectionList rows={rows} />
            )}
          </>
        )}

        <p className="sb-col-footnote">
          Los valores son estimados a partir del precio de mercado NM de cada carta.{" "}
          <Link href="/binders">Ver mis binders</Link>
        </p>
      </main>
    </>
  );
}
