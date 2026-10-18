"use client";

import { authClient } from "../../lib/auth-client";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="sb-site-nav-button"
      onClick={async () => {
        await authClient.signOut();
        window.location.assign("/");
      }}
    >
      Salir
    </button>
  );
}
