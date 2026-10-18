"use client";

import { useState } from "react";
import { authClient } from "../../lib/auth-client";

const BUTTON: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  width: "100%",
  padding: "13px 18px",
  borderRadius: 2,
  border: "1px solid var(--foil)",
  background: "transparent",
  color: "var(--linen)",
  fontSize: 13,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
};

export function GoogleSignInButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      style={{ ...BUTTON, opacity: pending ? 0.6 : 1 }}
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.signIn.social({ provider: "google", callbackURL: next });
        if (error) {
          setPending(false);
        }
      }}
    >
      {pending ? "Abriendo Google…" : "Continuar con Google"}
    </button>
  );
}

/** Local dev / e2e only (AUTH_DEV_LOGIN=1, never in production). */
export function DevLoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      aria-label="Acceso de desarrollo"
      style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const { error: signInError } = await authClient.signIn.email({
          email: String(data.get("email") ?? ""),
          password: String(data.get("password") ?? ""),
        });
        if (signInError) {
          setError("Correo o contraseña incorrectos.");
          return;
        }
        window.location.assign(next);
      }}
    >
      <p className="sb-label" style={{ margin: "8px 0 0", fontSize: 10, color: "var(--smoke)" }}>
        Acceso de desarrollo
      </p>
      <input name="email" type="email" aria-label="Correo" placeholder="Correo" required />
      <input
        name="password"
        type="password"
        aria-label="Contraseña"
        placeholder="Contraseña"
        required
      />
      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--foil)" }}>
          {error}
        </p>
      )}
      <button type="submit" style={BUTTON}>
        Entrar
      </button>
    </form>
  );
}
