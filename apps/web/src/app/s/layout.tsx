import type { ReactNode } from "react";

// Public share pages read live per-slug binder data from the DB, so they
// must never be statically prerendered (see app/binders/layout.tsx).
export const dynamic = "force-dynamic";

export default function ShareLayout({ children }: { children: ReactNode }) {
  return children;
}
