import type { Metadata } from "next";
import Link from "next/link";
import { GalleryCard } from "../../components/gallery/gallery-card";
import { SiteNav } from "../../components/site/site-nav";
import { type GallerySort, listGalleryBinders } from "../../lib/gallery";
import { getCurrentUser, isAdmin } from "../../lib/session";
import "../../components/library/catalog.css";

export const metadata: Metadata = {
  title: "Galería",
  description: "Binders públicos de la comunidad de Sleevebook.",
};

interface PageProps {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}

const MAX_QUERY_LENGTH = 80;

function parseSort(value: string | undefined): GallerySort {
  return value === "populares" ? "populares" : "recientes";
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** Builds a /galeria link that keeps the search and sort, dropping defaults. */
function galleryHref({ q, sort, page }: { q: string; sort: GallerySort; page?: number }): string {
  const params = new URLSearchParams();
  if (q) {
    params.set("q", q);
  }
  if (sort !== "recientes") {
    params.set("sort", sort);
  }
  if (page && page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/galeria?${query}` : "/galeria";
}

export default async function GalleriaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const sort = parseSort(params.sort);
  const page = parsePage(params.page);

  const [gallery, viewer] = await Promise.all([
    listGalleryBinders({ q, sort, page }),
    getCurrentUser(),
  ]);
  const canFeature = isAdmin(viewer);
  const showFeatured = page === 1 && gallery.featured.length > 0;
  const hasItems = gallery.items.length > 0;

  return (
    <>
      <SiteNav current="/galeria" />
      <main className="sb-catalog-page">
        <header>
          <p className="sb-catalog-eyebrow">
            Comunidad · {gallery.total}{" "}
            {gallery.total === 1 ? "binder público" : "binders públicos"}
          </p>
          <h1 className="sb-catalog-title">Galería</h1>
          <p className="sb-gallery-intro">
            Colecciones que sus dueños compartieron con un link público. Abre una para verla como en
            el visor.
          </p>
        </header>

        <search>
          <form action="/galeria" method="get" className="sb-gallery-search">
            <input
              type="search"
              name="q"
              defaultValue={q}
              aria-label="Buscar binders por nombre"
              placeholder="Buscar por nombre"
            />
            {sort !== "recientes" ? <input type="hidden" name="sort" value={sort} /> : null}
            <button type="submit">Buscar</button>
          </form>
        </search>

        <nav aria-label="Orden" className="sb-gallery-sort">
          <Link
            href={galleryHref({ q, sort: "recientes" })}
            aria-current={sort === "recientes" ? "page" : undefined}
          >
            Recientes
          </Link>
          <Link
            href={galleryHref({ q, sort: "populares" })}
            aria-current={sort === "populares" ? "page" : undefined}
          >
            Populares
          </Link>
        </nav>

        {showFeatured ? (
          <section aria-labelledby="gallery-featured-title" className="sb-gallery-section">
            <h2 id="gallery-featured-title" className="sb-gallery-section-title">
              Destacados
            </h2>
            <ul className="sb-gallery-grid sb-gallery-grid-featured">
              {gallery.featured.map((item) => (
                <GalleryCard key={item.id} binder={item} featured canFeature={canFeature} />
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="gallery-all-title" className="sb-gallery-section">
          <h2 id="gallery-all-title" className="sb-gallery-section-title">
            {q ? `Resultados para «${q}»` : "Binders públicos"}
          </h2>

          {hasItems ? (
            <ul className="sb-gallery-grid">
              {gallery.items.map((item) => (
                <GalleryCard key={item.id} binder={item} canFeature={canFeature} />
              ))}
            </ul>
          ) : (
            <p className="sb-gallery-empty">
              {q
                ? `No hay binders públicos que coincidan con «${q}».`
                : "Todavía no hay binders públicos en la galería."}
            </p>
          )}

          {gallery.pageCount > 1 ? (
            <nav aria-label="Paginación" className="sb-gallery-pager">
              {gallery.page > 1 ? (
                <Link href={galleryHref({ q, sort, page: gallery.page - 1 })}>Anterior</Link>
              ) : (
                <span aria-disabled="true">Anterior</span>
              )}
              <span className="sb-data">{`Página ${gallery.page} de ${gallery.pageCount}`}</span>
              {gallery.page < gallery.pageCount ? (
                <Link href={galleryHref({ q, sort, page: gallery.page + 1 })}>Siguiente</Link>
              ) : (
                <span aria-disabled="true">Siguiente</span>
              )}
            </nav>
          ) : null}
        </section>
      </main>
    </>
  );
}
