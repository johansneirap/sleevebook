import type { ListingStatus, ResolvedPrice } from "@sleevebook/binder-core";

/** Seller-mode visuals for one pocket, computed on the server. */
export interface PocketMeta {
  /** Already formatted in the binder currency, e.g. "$12.500". */
  price?: string;
  status?: ListingStatus;
  /** The price is a condition estimate of the linked copy (not a listing or an override). */
  estimated?: boolean;
}

/** Keyed by pocket code (e.g. "S1·F·1"). */
export type PocketMetaMap = Record<string, PocketMeta>;

/** Everything the buyer's list needs to know about one card pocket. */
export interface WantCatalogEntry {
  name: string;
  number?: string;
  setName?: string;
  status: ListingStatus;
  price?: ResolvedPrice;
}

export const STATUS_LABELS: Record<ListingStatus, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
};
