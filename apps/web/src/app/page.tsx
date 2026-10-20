import Link from "next/link";
import { LandingFeatured } from "../components/landing/landing-featured";
import { LandingFeatures } from "../components/landing/landing-features";
import { LandingHero } from "../components/landing/landing-hero";
import { getCurrentUser } from "../lib/session";

// The featured strip reads the DB, so the landing renders per request (it
// can't be prerendered at build time, where there is no database).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getCurrentUser();

  return (
    <main style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "12px clamp(20px, 5vw, 40px)",
          background: "var(--surface)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            minHeight: 44,
            color: "var(--ink)",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            textDecoration: "none",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "var(--accent)",
              color: "#ffffff",
              fontSize: 17,
              fontWeight: 800,
            }}
          >
            S
          </span>
          Sleevebook
        </Link>
        {viewer ? null : (
          <Link
            href="/entrar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              padding: "0 16px",
              borderRadius: 12,
              background: "var(--accent)",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Entrar
          </Link>
        )}
      </header>
      <LandingHero />
      <LandingFeatures />
      <LandingFeatured />
    </main>
  );
}
