"use client";

import { authClient } from "../../lib/auth-client";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="sb-app-signout"
      onClick={async () => {
        await authClient.signOut();
        window.location.assign("/");
      }}
    >
      Salir
    </button>
  );
}
