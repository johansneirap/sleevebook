import Link from "next/link";
import type { GalleryBinder } from "../../lib/gallery";
import { setFeatured } from "../../lib/gallery-actions";
import "./gallery.css";

interface GalleryCardProps {
  binder: GalleryBinder;
  featured?: boolean;
  /** Admins only: shows the Destacar / Quitar destacado control. */
  canFeature?: boolean;
}

// One binder in the public gallery. The cover and text link to the public
// binder; the owner handle and the admin toggle sit outside that link so no
// interactive elements are nested.
export function GalleryCard({ binder: b, featured = false, canFeature = false }: GalleryCardProps) {
  const sizeLabel = `${b.formatRows}×${b.formatCols} · ${b.sheets} hojas`;

  return (
    <li className={`sb-gallery-card${featured ? " sb-gallery-card-featured" : ""}`}>
      <Link href={`/s/${b.slug}`} className="sb-gallery-card-link">
        <span className="sb-gallery-cover">
          {/* biome-ignore lint/performance/noImgElement: dynamic OG image route, not an optimizable asset */}
          <img
            src={`/s/${b.slug}/opengraph-image`}
            alt=""
            loading="lazy"
            width={1200}
            height={630}
          />
        </span>
        <span className="sb-gallery-body">
          <span className="sb-gallery-name">{b.name}</span>
          <span className="sb-gallery-meta">
            <span className="sb-data">{sizeLabel}</span>
            {b.progress ? (
              <span className="sb-data">{`${b.progress.percentage}% completo`}</span>
            ) : null}
            <span className="sb-data">{`${b.views} ${b.views === 1 ? "vista" : "vistas"}`}</span>
          </span>
        </span>
      </Link>

      <div className="sb-gallery-owner">
        <Link href={`/u/${b.owner.handle}`}>{`@${b.owner.handle}`}</Link>
        {canFeature ? (
          <form action={setFeatured.bind(null, b.id, !featured)}>
            <button type="submit" className="sb-quiet-button">
              {featured ? "Quitar destacado" : "Destacar"}
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
