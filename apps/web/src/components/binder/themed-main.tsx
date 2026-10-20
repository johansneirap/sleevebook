import type { Layout } from "@sleevebook/binder-core";
import type { ReactNode } from "react";

// The page is the app: it always uses the light --bg. The binder theme only
// dresses the binder object (see binder-stage.tsx), so `theme` is accepted for
// callers that still pass it but does not paint the page.
export function ThemedMain({ children }: { theme?: Layout["theme"]; children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font-ui)",
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          marginInline: "auto",
          paddingBlock: "clamp(20px, 2.6vw, 32px)",
          paddingInline: "clamp(16px, 2.8vw, 40px)",
        }}
      >
        {children}
      </div>
    </main>
  );
}
