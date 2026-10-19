// Contract between the scanner UI (/escanear) and the scan server action.

/** What the vision model read off the photo. */
export interface ScanReading {
  name: string;
  setName?: string;
  /** Collector number as printed, e.g. "112", "TG05", "SWSH123". */
  number?: string;
  /** Printed set total, e.g. "198" in "112/198". */
  setTotal?: string;
  /** Visible foil treatment if the model can tell: "holo" | "reverse" | "normal". */
  finish?: string;
}

export interface ScanCandidate {
  variantId: string;
  name: string;
  setName: string;
  number: string;
  variant: string;
  imageUrl: string | null;
  /** 0..1, higher is a better match to the reading. */
  score: number;
}

export type ScanStatus =
  | "ok" // candidates found (may still be empty if nothing in the catalog matched)
  | "no-card" // the photo doesn't show a card the model can read
  | "limit" // daily scan limit reached
  | "disabled" // ANTHROPIC_API_KEY not configured
  | "invalid" // bad upload (type/size)
  | "error"; // API or server failure

export interface ScanResult {
  status: ScanStatus;
  reading?: ScanReading;
  candidates: ScanCandidate[];
  /** Scans left today for this user (after this one), when known. */
  remainingToday?: number;
  message?: string;
}

/** Upload limits the UI enforces before sending (the action re-checks). */
export const SCAN_MAX_BYTES = 1_500_000;
export const SCAN_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
