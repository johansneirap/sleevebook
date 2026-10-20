import Link from "next/link";
import type { CSSProperties } from "react";
import { listFeaturedGalleryBinders } from "../../lib/gallery";
import { GalleryCard } from "../gallery/gallery-card";

const LANDING_FEATURED_LIMIT = 3;

const SECTION: CSSProperties = {
  maxWidth: 1320,
  margin: "0 auto",
  padding: "clamp(24px, 5vh, 48px) clamp(20px, 5vw, 56px) clamp(40px, 8vh, 72px)",
  boxSizing: "border-box",
};

const HEAD: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  margin: 0,
};

const GRID: CSSProperties = {
  listStyle: "none",
  margin: "20px 0 0",
  padding: 0,
  display: "grid",
  gap: 20,
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
        <h2
          id="landing-featured-title"
          className="sb-label"
          style={{ margin: 0, color: "var(--ink)", fontSize: 18, fontWeight: 800 }}
        >
          Destacados
        </h2>
        <Link
          href="/galeria"
          style={{ color: "var(--accent)", fontSize: 14, fontWeight: 700, textDecoration: "none" }}
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
