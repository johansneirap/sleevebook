import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DevLoginForm, GoogleSignInButton } from "../../components/auth/sign-in";
import { devLoginEnabled, googleLoginEnabled } from "../../lib/auth";
import { getCurrentUser } from "../../lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar — Sleevebook" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

/** Only same-site paths, so ?next= can't bounce people to another site. */
function safeNext(next: string | undefined): string {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/binders";
}

export default async function SignInPage({ searchParams }: PageProps) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) {
    redirect(next);
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        boxSizing: "border-box",
        background: "var(--bg)",
      }}
    >
      <section
        style={{
          width: "min(400px, 100%)",
          boxSizing: "border-box",
          display: "grid",
          gap: 24,
          padding: "32px 28px",
          borderRadius: 20,
          border: "1px solid var(--line)",
          background: "var(--surface)",
          boxShadow: "var(--shadow)",
        }}
      >
        <div style={{ display: "grid", justifyItems: "center", gap: 16, textAlign: "center" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              color: "var(--ink)",
              fontSize: 18,
              fontWeight: 800,
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
          <div>
            <h1
              className="sb-display"
              style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "var(--ink)" }}
            >
              Entrar
            </h1>
            <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.6 }}>
              Tus binders, tu lista de deseos y tus avisos, en tu cuenta.
            </p>
          </div>
        </div>

        {googleLoginEnabled ? (
          <GoogleSignInButton next={next} />
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", textAlign: "center" }}>
            El acceso con Google aún no está configurado.
          </p>
        )}

        {devLoginEnabled && <DevLoginForm next={next} />}
      </section>
    </main>
  );
}
