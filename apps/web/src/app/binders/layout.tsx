import type { ReactNode } from "react";

// These pages read live per-user binder data from the DB (and will read the
// session once auth lands), so they must never be statically prerendered.
export const dynamic = "force-dynamic";

export default function BindersLayout({ children }: { children: ReactNode }) {
  return children;
}
