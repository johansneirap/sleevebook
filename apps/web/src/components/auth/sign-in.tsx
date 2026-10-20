"use client";

import { type CSSProperties, useState } from "react";
import { authClient } from "../../lib/auth-client";

const BUTTON: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  width: "100%",
  minHeight: 48,
  boxSizing: "border-box",
  padding: "0 18px",
  borderRadius: 14,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#ffffff",
  fontFamily: "var(--font-ui)",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};

const GOOGLE_BUTTON: CSSProperties = {
  ...BUTTON,
  background: "#ffffff",
  border: "1px solid var(--line)",
  color: "var(--ink)",
};

const FIELD: CSSProperties = {
  width: "100%",
  minHeight: 44,
  boxSizing: "border-box",
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "var(--font-ui)",
  fontSize: 15,
};

// Official-style multicolor "G" for the Google button.
function GoogleMark() {
  return (
    <svg width={20} height={20} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.341-.379-4.593-1.084-6.714z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.341-.379-4.593-1.084-6.714z"
      />
    </svg>
  );
}

export function GoogleSignInButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      style={{ ...GOOGLE_BUTTON, opacity: pending ? 0.6 : 1 }}
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.signIn.social({ provider: "google", callbackURL: next });
        if (error) {
          setPending(false);
        }
      }}
    >
      <GoogleMark />
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
      style={{ display: "grid", gap: 10, textAlign: "left" }}
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
      <p
        className="sb-label"
        style={{ margin: 0, fontSize: 13, color: "var(--muted)", textAlign: "center" }}
      >
        Acceso de desarrollo
      </p>
      <input
        name="email"
        type="email"
        aria-label="Correo"
        placeholder="Correo"
        required
        style={FIELD}
      />
      <input
        name="password"
        type="password"
        aria-label="Contraseña"
        placeholder="Contraseña"
        required
        style={FIELD}
      />
      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 14, color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <button type="submit" style={BUTTON}>
        Entrar
      </button>
    </form>
  );
}
