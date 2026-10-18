import Link from "next/link";
import type { CSSProperties } from "react";
import { listFeaturedGalleryBinders } from "../../lib/gallery";
import { GalleryCard } from "../gallery/gallery-card";

const LANDING_FEATURED_LIMIT = 3;

const SECTION: CSSProperties = {
  padding: "clamp(40px, 8vh, 80px) clamp(16px, 5vw, 56px)",
  maxWidth: 1040,
};

const HEAD: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
  margin: 0,
  paddingTop: 18,
  position: "relative",
};

const GRID: CSSProperties = {
  listStyle: "none",
  margin: "24px 0 0",
  padding: 0,
  display: "grid",
  gap: "36px 28px",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
};

// Server component: up to three featured public binders, or nothing at all.
export async function LandingFeatured() {
  const featured = await listFeaturedGalleryBinders(LANDING_FEATURED_LIMIT);
  if (featured.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="landing-featured-title"
      style={SECTION}
      data-testid="landing-featured"
    >
      <div style={HEAD}>
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: "linear-gradient(90deg, transparent, var(--foil), transparent)",
          }}
        />
        <h2
          id="landing-featured-title"
          className="sb-label"
          style={{ margin: 0, color: "var(--smoke)", fontSize: 12, fontWeight: 400 }}
        >
          Destacados
        </h2>
        <Link
          href="/galeria"
          className="sb-label"
          style={{ color: "var(--smoke)", fontSize: 12, textDecoration: "none" }}
        >
          Ver la galería
        </Link>
      </div>
      <ul style={GRID}>
        {featured.map((item) => (
          <GalleryCard key={item.id} binder={item} />
        ))}
      </ul>
    </section>
  );
}
