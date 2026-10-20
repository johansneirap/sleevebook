"use client";

import { useSyncExternalStore } from "react";

// Phones (< 768px) show one page at a time. Server render and the first client
// render assume the laptop layout; the phone layout takes over after hydration.
const QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useCompactLayout(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
