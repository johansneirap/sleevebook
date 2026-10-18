"use client";

import { authClient } from "../../lib/auth-client";

/** Quiet top line of the library: who is signed in, and a way out. */
export function AccountBar({ name, handle }: { name: string; handle: string }) {
  return (
    <div
      className="sb-label"
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 14,
        fontSize: 11,
        color: "var(--smoke)",
        marginBottom: 28,
      }}
    >
      <span>
        {name}
        {handle && <span className="sb-data"> · @{handle}</span>}
      </span>
      <button
        type="button"
        onClick={async () => {
          await authClient.signOut();
          window.location.assign("/");
        }}
        style={{
          background: "none",
          border: 0,
          padding: 0,
          color: "inherit",
          font: "inherit",
          letterSpacing: "inherit",
          textTransform: "inherit",
          cursor: "pointer",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        Salir
      </button>
    </div>
  );
}
