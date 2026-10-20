import Link from "next/link";
import { getCurrentUser, isAdmin } from "../../lib/session";
import { NotificationBell } from "./notification-bell";
import { SignOutButton } from "./sign-out-button";

// App shell (docs/DESIGN_BRIEF.md v2 "Estante"). Desktop (>= 768px): white top
// bar with pill links, search, "Escanear" and account. Mobile: compact header
// (logo, bell, "Más") plus a fixed bottom tab bar with the five destinations.
// Pages reserve room for the tab bar with `var(--sb-tabbar-h)` (0 on desktop):
//   padding-bottom: calc(var(--sb-tabbar-h, 0px) + 32px);
const CSS = `
:root {
  --sb-tabbar-h: 0px;
}
@media (max-width: 767px) {
  :root {
    --sb-tabbar-h: calc(72px + env(safe-area-inset-bottom, 0px));
  }
}

.sb-app-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  font-family: var(--font-ui);
}
.sb-app-left,
.sb-app-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.sb-app-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  color: var(--ink);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.01em;
  text-decoration: none;
}
.sb-app-brand:hover {
  color: var(--ink);
}
.sb-app-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--accent);
  color: #ffffff;
  font-size: 17px;
  font-weight: 800;
}
.sb-app-links {
  display: none;
  gap: 4px;
  margin-left: 20px;
}
.sb-app-links a,
.sb-app-account a,
.sb-app-more-menu a {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.sb-app-links a:hover,
.sb-app-account a:hover {
  background: var(--surface-2);
  color: var(--ink);
}
.sb-app-links a[aria-current="page"] {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 700;
}
.sb-app-search {
  display: none;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 240px;
  height: 40px;
  padding: 0 12px;
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--muted);
}
.sb-app-search-form {
  flex: 1;
  min-width: 0;
  margin: 0;
  display: flex;
}
.sb-app-search input {
  flex: 1;
  min-width: 0;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 14px;
  box-shadow: none;
}
.sb-app-search input::placeholder {
  color: var(--muted);
}
.sb-app-enter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  background: var(--accent);
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}
.sb-app-scan {
  display: none;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  background: var(--accent);
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}
.sb-app-scan:hover,
.sb-app-enter:hover {
  background: var(--accent-strong);
  color: #ffffff;
}
.sb-app-account {
  display: none;
  align-items: center;
  gap: 4px;
}
.sb-app-signout {
  min-height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
}
.sb-app-signout:hover:not(:disabled) {
  background: var(--surface-2);
  color: var(--ink);
}
.sb-app-more {
  position: relative;
}
.sb-app-more > summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
  list-style: none;
  cursor: pointer;
}
.sb-app-more > summary::-webkit-details-marker {
  display: none;
}
.sb-app-more[open] > summary {
  background: var(--surface-2);
}
.sb-app-more-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 60;
  display: grid;
  gap: 2px;
  min-width: 200px;
  padding: 8px;
  box-sizing: border-box;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: var(--shadow);
}
.sb-app-more-menu a,
.sb-app-more-menu .sb-app-signout {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  text-align: left;
}
.sb-tabbar {
  display: none;
}

@media (min-width: 768px) {
  .sb-app-top {
    padding: 16px 40px;
    gap: 24px;
  }
  .sb-app-links,
  .sb-app-search,
  .sb-app-scan,
  .sb-app-account {
    display: flex;
  }
  .sb-app-more {
    display: none;
  }
}

@media (max-width: 767px) {
  .sb-app-right .sb-app-search,
  .sb-app-right .sb-app-scan,
  .sb-app-right .sb-app-account {
    display: none;
  }
  .sb-tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: end;
    gap: 2px;
    box-sizing: border-box;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
    background: var(--surface);
    border-top: 1px solid var(--line);
    font-family: var(--font-ui);
  }
  .sb-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: 56px;
    border-radius: 12px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    text-decoration: none;
  }
  .sb-tab:hover {
    color: var(--ink);
  }
  .sb-tab[aria-current="page"] {
    color: var(--accent);
    font-weight: 700;
  }
  .sb-tab-scan {
    justify-self: center;
    width: 58px;
    height: 58px;
    margin-top: -28px;
    border-radius: 18px;
    background: var(--accent);
    color: #ffffff;
    box-shadow: 0 8px 20px rgba(52, 81, 209, 0.35);
  }
  .sb-tab-scan:hover,
  .sb-tab-scan[aria-current="page"] {
    background: var(--accent-strong);
    color: #ffffff;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sb-app-links a,
  .sb-app-account a,
  .sb-app-signout,
  .sb-tab {
    transition: none;
  }
}
`;

const DESKTOP_LINKS = [
  { href: "/binders", label: "Mis binders" },
  { href: "/deseos", label: "Deseos" },
  { href: "/intercambios", label: "Intercambios" },
  { href: "/galeria", label: "Galería" },
] as const;

const MORE_LINKS = [
  { href: "/galeria", label: "Galería" },
  { href: "/plantillas", label: "Plantillas" },
] as const;

const TABS = [
  { href: "/binders", label: "Binders" },
  { href: "/deseos", label: "Deseos" },
  { href: "/intercambios", label: "Cambios" },
  { href: "/cuenta", label: "Cuenta" },
] as const;

const SVG_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function TabIcon({ href }: { href: string }) {
  switch (href) {
    case "/binders":
      return (
        <svg width={22} height={22} strokeWidth={2} aria-hidden="true" {...SVG_PROPS}>
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      );
    case "/deseos":
      return (
        <svg width={22} height={22} strokeWidth={2} aria-hidden="true" {...SVG_PROPS}>
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      );
    case "/intercambios":
      return (
        <svg width={22} height={22} strokeWidth={2} aria-hidden="true" {...SVG_PROPS}>
          <path d="m16 3 4 4-4 4" />
          <path d="M20 7H4" />
          <path d="m8 21-4-4 4-4" />
          <path d="M4 17h16" />
        </svg>
      );
    default:
      return (
        <svg width={22} height={22} strokeWidth={2} aria-hidden="true" {...SVG_PROPS}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
  }
}

/** `current` is the href of the section being viewed, for aria-current. */
export async function SiteNav({ current }: { current?: string }) {
  const viewer = await getCurrentUser();
  const admin = isAdmin(viewer);
  const ariaCurrent = (href: string) => (current === href ? "page" : undefined);

  return (
    <>
      <style>{CSS}</style>
      <header className="sb-app-top">
        <div className="sb-app-left">
          <Link href="/" className="sb-app-brand">
            <span className="sb-app-mark" aria-hidden="true">
              S
            </span>
            Sleevebook
          </Link>
          {viewer ? (
            <nav aria-label="Principal" className="sb-app-links">
              {DESKTOP_LINKS.map((link) => (
                <Link key={link.href} href={link.href} aria-current={ariaCurrent(link.href)}>
                  {link.label}
                </Link>
              ))}
              {admin && (
                <Link href="/admin/mascaras" aria-current={ariaCurrent("/admin/mascaras")}>
                  Máscaras de foil
                </Link>
              )}
            </nav>
          ) : null}
        </div>

        <div className="sb-app-right">
          {viewer ? (
            <>
              <search className="sb-app-search">
                <svg width={16} height={16} strokeWidth={2} aria-hidden="true" {...SVG_PROPS}>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <form action="/galeria" className="sb-app-search-form">
                  <input
                    type="search"
                    name="q"
                    aria-label="Buscar binders públicos"
                    placeholder="Buscar binders públicos…"
                  />
                </form>
              </search>
              <Link
                href="/escanear"
                className="sb-app-scan"
                aria-current={ariaCurrent("/escanear")}
              >
                Escanear
              </Link>
              <NotificationBell userId={viewer.id} />
              <div className="sb-app-account">
                <Link href="/cuenta" aria-current={ariaCurrent("/cuenta")}>
                  {viewer.handle ? `@${viewer.handle}` : viewer.name}
                </Link>
                <SignOutButton />
              </div>
              <details className="sb-app-more">
                <summary>
                  Más
                  <svg width={14} height={14} strokeWidth={2.5} aria-hidden="true" {...SVG_PROPS}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <div className="sb-app-more-menu">
                  {MORE_LINKS.map((link) => (
                    <Link key={link.href} href={link.href} aria-current={ariaCurrent(link.href)}>
                      {link.label}
                    </Link>
                  ))}
                  {admin && (
                    <Link href="/admin/mascaras" aria-current={ariaCurrent("/admin/mascaras")}>
                      Máscaras de foil
                    </Link>
                  )}
                  <SignOutButton />
                </div>
              </details>
            </>
          ) : (
            <Link href="/entrar" className="sb-app-enter">
              Entrar
            </Link>
          )}
        </div>
      </header>

      {viewer ? (
        <nav aria-label="Navegación inferior" className="sb-tabbar">
          {TABS.slice(0, 2).map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="sb-tab"
              aria-current={ariaCurrent(tab.href)}
            >
              <TabIcon href={tab.href} />
              {tab.label}
            </Link>
          ))}
          <Link
            href="/escanear"
            className="sb-tab sb-tab-scan"
            aria-label="Escanear"
            aria-current={ariaCurrent("/escanear")}
          >
            <svg width={26} height={26} strokeWidth={2} aria-hidden="true" {...SVG_PROPS}>
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <rect x="8" y="7" width="8" height="10" rx="1.5" />
            </svg>
          </Link>
          {TABS.slice(2).map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="sb-tab"
              aria-current={ariaCurrent(tab.href)}
            >
              <TabIcon href={tab.href} />
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}
