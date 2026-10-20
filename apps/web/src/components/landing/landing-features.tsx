import type { CSSProperties, ReactNode } from "react";

const FEATURES: Array<{ title: string; note: string; icon: ReactNode }> = [
  {
    title: "Holo que reacciona a la luz",
    note: "El foil se mueve con el puntero y con la luz de la sala.",
    icon: (
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    ),
  },
  {
    title: "Páginas que se curvan",
    note: "Cada hoja se pasa desde la esquina, con peso, como en un álbum real.",
    icon: (
      <>
        <path d="M4 5.5C7 4 10 4 12 6c2-2 5-2 8-.5V19c-3-1.5-6-1.5-8 .5-2-2-5-2-8-.5Z" />
        <path d="M12 6v13.5" />
      </>
    ),
  },
  {
    title: "Link público para compartir",
    note: "Muestra un binder con una URL, sin dar acceso a tu cuenta.",
    icon: (
      <>
        <path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.5-1.5" />
      </>
    ),
  },
];

const SECTION: CSSProperties = {
  maxWidth: 1320,
  margin: "0 auto",
  padding: "clamp(24px, 5vh, 48px) clamp(20px, 5vw, 56px) 8px",
  boxSizing: "border-box",
};

const GRID: CSSProperties = {
  listStyle: "none",
  margin: "16px 0 0",
  padding: 0,
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
};

const CARD: CSSProperties = {
  display: "grid",
  gap: 14,
  alignContent: "start",
  height: "100%",
  boxSizing: "border-box",
  padding: 20,
  borderRadius: 20,
  background: "var(--surface)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow)",
};

const ICON_TILE: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 44,
  height: 44,
  borderRadius: 14,
  background: "var(--accent-soft)",
  color: "var(--accent)",
};

export function LandingFeatures() {
  return (
    <section aria-labelledby="landing-features-label" style={SECTION}>
      <h2
        id="landing-features-label"
        className="sb-label"
        style={{ margin: 0, color: "var(--ink)", fontSize: 18, fontWeight: 800 }}
      >
        Pensado para tu colección
      </h2>
      <ul style={GRID}>
        {FEATURES.map((feature) => (
          <li key={feature.title} style={CARD}>
            <span style={ICON_TILE}>
              <svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {feature.icon}
              </svg>
            </span>
            <div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                {feature.title}
              </p>
              <p
                style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--muted)" }}
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
