import { z } from "zod";
import type { Layout } from "./layout-schema";
import { type Currency, convertFromUsd, convertMoney, type ExchangeRates } from "./money";

export const BINDER_MODES = ["collection", "seller"] as const;
export type BinderMode = (typeof BINDER_MODES)[number];

export const LISTING_STATUSES = ["disponible", "reservado", "vendido"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export const listingStatusSchema = z.enum(LISTING_STATUSES);

/** Contact channels shown on a seller binder's public page. All optional. */
export const sellerContactSchema = z.object({
  /** Digits only, with country code, e.g. "56912345678" (wa.me format). */
  whatsapp: z
    .string()
    .regex(/^\d{8,15}$/)
    .optional(),
  /** Handle without "@". */
  instagram: z
    .string()
    .regex(/^[A-Za-z0-9._]{1,30}$/)
    .optional(),
  email: z.email().optional(),
});
export type SellerContact = z.infer<typeof sellerContactSchema>;

/** Seller-mode state of one pocket (pocket_listing row). */
export interface PocketListing {
  status: ListingStatus;
  /** Asking price in `currency`; null falls back to override/market. */
  price: number | null;
  currency: Currency;
}

export type PriceOrigin = "vendedor" | "manual" | "mercado";

export interface ResolvedPrice {
  amount: number;
  currency: Currency;
  origin: PriceOrigin;
}

/**
 * Price shown for a card pocket, in `display` currency. Precedence:
 * seller listing price > owner's manual override (USD) > market price (USD).
 * Undefined when nothing applies or the needed exchange rate is missing.
 */
export function resolvePocketPrice(
  content: Layout["pockets"][string],
  listing: PocketListing | undefined,
  marketUsd: number | undefined,
  display: Currency,
  rates: ExchangeRates,
): ResolvedPrice | undefined {
  if (content.kind !== "card") {
    return undefined;
  }
  if (listing?.price != null) {
    const amount = convertMoney(listing.price, listing.currency, display, rates);
    return amount === undefined ? undefined : { amount, currency: display, origin: "vendedor" };
  }
  const usd = content.priceOverrideUsd ?? marketUsd;
  if (usd === undefined) {
    return undefined;
  }
  const amount = convertFromUsd(usd, display, rates);
  return amount === undefined
    ? undefined
    : {
        amount,
        currency: display,
        origin: content.priceOverrideUsd !== undefined ? "manual" : "mercado",
      };
}

/** Plain-text list a buyer copies to send the seller ("copiar lista"). */
export function formatWantList(
  items: Array<{
    pocketCode: string;
    name: string;
    number?: string;
    setName?: string;
    price?: ResolvedPrice;
  }>,
  formatPrice: (price: ResolvedPrice) => string,
): string {
  const lines = items.map((item) => {
    const label = [item.name, item.number && `#${item.number}`, item.setName && `(${item.setName})`]
      .filter(Boolean)
      .join(" ");
    const price = item.price ? ` — ${formatPrice(item.price)}` : "";
    return `• ${label} [${item.pocketCode}]${price}`;
  });
  return lines.join("\n");
}
