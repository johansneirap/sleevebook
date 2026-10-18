import type { Layout } from "@sleevebook/binder-core";
import type { ReactNode } from "react";
import { resolveThemeTokens } from "../../lib/theme-presets";

export function ThemedMain({ theme, children }: { theme: Layout["theme"]; children: ReactNode }) {
  const tokens = resolveThemeTokens(theme);
  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        background: tokens.background,
        color: tokens.foreground,
        fontFamily: tokens.fontFamily,
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          marginInline: "auto",
          paddingBlock: "clamp(16px, 2.4vw, 32px)",
          paddingInline: "clamp(16px, 4vw, 48px)",
        }}
      >
        {children}
      </div>
    </main>
  );
}
