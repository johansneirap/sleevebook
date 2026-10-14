import type { Layout } from "@sleevebook/binder-core";
import type { ReactNode } from "react";
import { resolveThemeTokens } from "../../lib/theme-presets";

export function ThemedMain({ theme, children }: { theme: Layout["theme"]; children: ReactNode }) {
  const tokens = resolveThemeTokens(theme);
  return (
    <main
      style={{
        padding: 24,
        fontFamily: tokens.fontFamily,
        background: tokens.background,
        color: tokens.foreground,
        minHeight: "100vh",
      }}
    >
      {children}
    </main>
  );
}
