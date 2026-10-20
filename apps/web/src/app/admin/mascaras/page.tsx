import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "../../../components/site/site-nav";
import { getVariantDisplays, type VariantDisplay } from "../../../lib/binders";
import {
  FOIL_VARIANT_LABEL,
  FOIL_VARIANTS,
  listVariantIdsInBinders,
} from "../../../lib/foil-masks";
import { isAdmin, requireUser } from "../../../lib/session";
import "../../../components/library/catalog.css";
import "../../../components/foil-mask-editor/foil-mask-editor.css";
import "./mascaras.css";

export const metadata: Metadata = {
  title: "Máscaras de foil",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 48;
const MAX_QUERY_LENGTH = 80;
const STATUSES = ["todas", "por-defecto", "editadas"] as const;
type StatusFilter = (typeof STATUSES)[number];

const STATUS_LABEL: Record<StatusFilter, string> = {
  todas: "Todas",
  "por-defecto": "Por defecto",
  editadas: "Editadas",
};

interface PageProps {
  searchParams: Promise<{ q?: string; estado?: string; pagina?: string }>;
}

function parseStatus(value: string | undefined): StatusFilter {
  return (STATUSES as readonly string[]).includes(value ?? "") ? (value as StatusFilter) : "todas";
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** Keeps the search and status in pagination links, dropping defaults. */
function adminHref({ q, status, page }: { q: string; status: StatusFilter; page?: number }) {
  const params = new URLSearchParams();
  if (q) {
    params.set("q", q);
  }
  if (status !== "todas") {
    params.set("estado", status);
  }
  if (page && page > 1) {
    params.set("pagina", String(page));
  }
  const query = params.toString();
  return query ? `/admin/mascaras?${query}` : "/admin/mascaras";
}

function isFoilVariant(display: VariantDisplay): boolean {
  return (FOIL_VARIANTS as readonly string[]).includes(display.variant);
}

export default async function MascarasPage({ searchParams }: PageProps) {
  const viewer = await requireUser("/admin/mascaras");
  if (!isAdmin(viewer)) {
    notFound();
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const status = parseStatus(params.estado);
  const page = parsePage(params.pagina);

  const variantIds = await listVariantIdsInBinders();
  const displays = await getVariantDisplays(variantIds);
  const foilCards = [...displays.values()]
    .filter(isFoilVariant)
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "es") ||
        a.setName.localeCompare(b.setName, "es") ||
        a.number.localeCompare(b.number, "es", { numeric: true }),
    );
  const editedCount = foilCards.filter((card) => card.foilMask).length;

  const needle = q.toLowerCase();
  const filtered = foilCards.filter(
    (card) =>
      (status === "todas" || (status === "editadas") === Boolean(card.foilMask)) &&
      (!needle || card.name.toLowerCase().includes(needle)),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const items = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <>
      <SiteNav current="/admin/mascaras" />
      <main className="sb-catalog-page">
        <header>
          <p className="sb-catalog-eyebrow">
            Administración · {editedCount} de {foilCards.length} con máscara propia
          </p>
          <h1 className="sb-catalog-title">Máscaras de foil</h1>
          <p className="sb-mask-intro">
            Dónde brilla el foil de cada carta. Solo aparecen holo, reverse, pokeball y master ball
            de los binders. Sin máscara propia, la carta usa la máscara por defecto de su variante.
          </p>
        </header>

        <form action="/admin/mascaras" method="get" className="sb-mask-filters">
          <label className="sb-mask-field">
            <span className="sb-label">Buscar por nombre</span>
            <input type="search" name="q" defaultValue={q} placeholder="Nombre de la carta" />
          </label>
          <label className="sb-mask-field">
            <span className="sb-label">Estado</span>
            <select name="estado" defaultValue={status}>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="sb-mask-btn sb-mask-btn-primary">
            Filtrar
          </button>
        </form>

        <p className="sb-mask-count sb-data" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "carta" : "cartas"}
        </p>

        {items.length === 0 ? (
          <p className="sb-catalog-empty">No hay cartas con foil que coincidan con el filtro.</p>
        ) : (
          <ul className="sb-mask-grid">
            {items.map((card) => (
              <li key={card.id} className="sb-mask-item">
                <Link href={`/admin/mascaras/${card.id}`} className="sb-mask-link">
                  <span className="sb-mask-thumb">
                    {card.imageUrl ? (
                      // biome-ignore lint/performance/noImgElement: thumbnails from the catalog CDN
                      <img src={card.imageUrl} alt="" width={63} height={88} loading="lazy" />
                    ) : null}
                  </span>
                  <span className="sb-mask-text">
                    <span className="sb-mask-name">{card.name}</span>
                    <span className="sb-mask-meta sb-data">
                      {card.setName} · {card.number}
                    </span>
                    <span className="sb-mask-variant">
                      {FOIL_VARIANT_LABEL[card.variant] ?? card.variant}
                    </span>
                  </span>
                  <span className={`sb-mask-chip${card.foilMask ? " sb-mask-chip-edited" : ""}`}>
                    {card.foilMask ? "Editada" : "Por defecto"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {pageCount > 1 ? (
          <nav aria-label="Paginación" className="sb-mask-pager">
            {current > 1 ? (
              <Link href={adminHref({ q, status, page: current - 1 })}>Anterior</Link>
            ) : (
              <span aria-hidden="true">Anterior</span>
            )}
            <span className="sb-data">
              {current} / {pageCount}
            </span>
            {current < pageCount ? (
              <Link href={adminHref({ q, status, page: current + 1 })}>Siguiente</Link>
            ) : (
              <span aria-hidden="true">Siguiente</span>
            )}
          </nav>
        ) : null}
      </main>
    </>
  );
}
