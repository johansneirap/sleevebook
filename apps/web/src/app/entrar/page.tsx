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
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        padding: "48px 16px",
        background: "radial-gradient(ellipse at 50% 20%, var(--velvet-raised), var(--velvet) 70%)",
      }}
    >
      <section
        style={{
          width: "min(380px, 100%)",
          display: "flex",
          flexDirection: "column",
          gap: 28,
          textAlign: "center",
        }}
      >
        <div>
          <Link
            href="/"
            className="sb-display"
            style={{ fontSize: 22, color: "var(--linen)", textDecoration: "none" }}
          >
            Sleevebook
          </Link>
          <h1
            className="sb-display"
            style={{ margin: "28px 0 10px", fontSize: 44, fontWeight: 400, color: "var(--linen)" }}
          >
            Entrar
          </h1>
          <p style={{ margin: 0, color: "var(--smoke)", lineHeight: 1.6 }}>
            Tus binders, tu lista de deseos y tus avisos, en tu cuenta.
          </p>
        </div>

        {googleLoginEnabled ? (
          <GoogleSignInButton next={next} />
        ) : (
          <p className="sb-label" style={{ margin: 0, fontSize: 11, color: "var(--smoke)" }}>
            El acceso con Google aún no está configurado.
          </p>
        )}

        {devLoginEnabled && <DevLoginForm next={next} />}
      </section>
    </main>
  );
}
