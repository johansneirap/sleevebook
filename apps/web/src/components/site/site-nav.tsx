import Link from "next/link";
import { getCurrentUser } from "../../lib/session";
import { NotificationBell } from "./notification-bell";
import { SignOutButton } from "./sign-out-button";

// Site-wide navigation for the app and community pages (not the binder
// viewer, public links or embeds, which keep the binder as the only focus).
// Quiet small caps; foil only on hover and on the current section.
const CSS = `
.sb-site-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 28px;
  padding-bottom: 14px;
  margin-bottom: 36px;
  border-bottom: 1px solid var(--rule);
  font-family: var(--font-ui);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.sb-site-nav nav,
.sb-site-nav .sb-site-nav-account {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
}
.sb-site-nav a,
.sb-site-nav-button {
  color: var(--smoke);
  text-decoration: none;
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  cursor: pointer;
  transition: color 240ms var(--ease-out-expo);
}
.sb-site-nav a:hover,
.sb-site-nav a:focus-visible,
.sb-site-nav-button:hover,
.sb-site-nav-button:focus-visible,
.sb-site-nav a[aria-current="page"] {
  color: var(--foil);
}
.sb-site-nav .sb-site-nav-mark {
  font-family: var(--font-display);
  font-size: 22px;
  letter-spacing: 0;
  text-transform: none;
  color: var(--linen);
}
@media (prefers-reduced-motion: reduce) {
  .sb-site-nav a,
  .sb-site-nav-button {
    transition: none;
  }
}
`;

const LINKS = [
  { href: "/galeria", label: "Galería" },
  { href: "/plantillas", label: "Plantillas" },
  { href: "/intercambios", label: "Intercambios" },
  { href: "/deseos", label: "Mis deseos" },
  { href: "/escanear", label: "Escanear" },
  { href: "/binders", label: "Mis binders" },
] as const;

/** `current` is the href of the section being viewed, for aria-current. */
export async function SiteNav({ current }: { current?: string }) {
  const viewer = await getCurrentUser();
  return (
    <header className="sb-site-nav">
      <style>{CSS}</style>
      <nav aria-label="Principal">
        <Link href="/" className="sb-site-nav-mark">
          Sleevebook
        </Link>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current === link.href ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="sb-site-nav-account">
        {viewer ? (
          <>
            <NotificationBell userId={viewer.id} />
            <Link href="/cuenta" aria-current={current === "/cuenta" ? "page" : undefined}>
              {viewer.handle ? `@${viewer.handle}` : viewer.name}
            </Link>
            <SignOutButton />
          </>
        ) : (
          <Link href="/entrar">Entrar</Link>
        )}
      </div>
    </header>
  );
}
