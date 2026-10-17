import type { ReactNode } from "react";

// Embeds read live per-slug binder data from the DB, so they must never be
// statically prerendered (same reasoning as app/s/layout.tsx).
export const dynamic = "force-dynamic";

export default function EmbedLayout({ children }: { children: ReactNode }) {
  return children;
}
