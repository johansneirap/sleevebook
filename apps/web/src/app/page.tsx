import { LandingFeatured } from "../components/landing/landing-featured";
import { LandingFeatures } from "../components/landing/landing-features";
import { LandingHero } from "../components/landing/landing-hero";

// The featured strip reads the DB, so the landing renders per request (it
// can't be prerendered at build time, where there is no database).
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100dvh", background: "var(--velvet)" }}>
      <LandingHero />
      <LandingFeatures />
      <LandingFeatured />
    </main>
  );
}
