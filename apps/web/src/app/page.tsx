import { LandingFeatured } from "../components/landing/landing-featured";
import { LandingFeatures } from "../components/landing/landing-features";
import { LandingHero } from "../components/landing/landing-hero";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100dvh", background: "var(--velvet)" }}>
      <LandingHero />
      <LandingFeatures />
      <LandingFeatured />
    </main>
  );
}
