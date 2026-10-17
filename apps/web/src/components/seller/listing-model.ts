import type { Currency, ListingStatus } from "@sleevebook/binder-core";

/** One editable draft of a pocket's listing. `price` is the raw input text. */
export interface ListingDraft {
  status: ListingStatus;
  price: string;
}

export type PriceParse = { ok: true; value: number | null } | { ok: false; error: string };

const PRICE_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/** Empty means "no asking price" (use market/manual). Accepts "," as decimal separator. */
export function parsePriceInput(raw: string, currency?: Currency): PriceParse {
  // CLP has no decimals, so "15.000" / "15,000" are thousands separators.
  const trimmed =
    currency === "clp" ? raw.trim().replace(/[.,]/g, "") : raw.trim().replace(",", ".");
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (!PRICE_PATTERN.test(trimmed)) {
    return { ok: false, error: "Precio no válido. Usa números, por ejemplo 15000." };
  }
  const value = Number(trimmed);
  if (value <= 0) {
    return { ok: false, error: "El precio debe ser mayor que cero." };
  }
  return { ok: true, value };
}

/** Stored price (in the binder currency) as an input value. CLP has no decimals. */
export function priceToInput(amount: number | null, currency: Currency): string {
  if (amount === null) {
    return "";
  }
  return currency === "clp" ? String(Math.round(amount)) : String(Math.round(amount * 100) / 100);
}

export function sameDraft(a: ListingDraft, b: ListingDraft): boolean {
  return a.status === b.status && a.price.trim() === b.price.trim();
}
