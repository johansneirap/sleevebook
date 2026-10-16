import type { CSSProperties } from "react";

const FEATURES = [
  {
    code: "01",
    title: "Holo que reacciona a la luz",
    note: "El foil se mueve con el puntero y con la luz de la sala.",
  },
  {
    code: "02",
    title: "Páginas que se curvan",
    note: "Cada hoja se pasa desde la esquina, con peso, como en un álbum real.",
  },
  {
    code: "03",
    title: "Link público para compartir",
    note: "Muestra un binder con una URL, sin dar acceso a tu cuenta.",
  },
] as const;

const SECTION: CSSProperties = {
  padding: "clamp(40px, 8vh, 80px) clamp(16px, 5vw, 56px)",
  maxWidth: 880,
};

const ITEM: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "56px minmax(0, 1fr)",
  gap: 16,
  padding: "22px 0",
  borderTop: "1px solid var(--rule)",
};

export function LandingFeatures() {
  return (
    <section aria-labelledby="landing-features-label" style={SECTION}>
      <p
        id="landing-features-label"
        className="sb-label"
        style={{ margin: "0 0 12px", color: "var(--smoke)", fontSize: 12 }}
      >
        Catálogo
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {FEATURES.map((feature) => (
          <li key={feature.code} style={ITEM}>
            <span className="sb-data" style={{ color: "var(--foil)", fontSize: 13, paddingTop: 3 }}>
              {feature.code}
            </span>
            <div>
              <p style={{ margin: 0, fontSize: 17, color: "var(--linen)" }}>{feature.title}</p>
              <p
                style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--smoke)" }}
              >
                {feature.note}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
