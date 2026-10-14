// The tracker key format is "<pokemontcg.io card id>.<suffix>" for cards that
// exist in the catalog (e.g. "bw1-70.n"), and "x-NN" for the 25 store/promo
// exclusives with no catalog entry ("special": true in the seed).
const CATALOG_KEY_PATTERN = /^(.+)\.([a-z]+)$/;

const SUFFIX_TO_VARIANT: Record<string, string> = {
  n: "normal",
  h: "holo",
  r: "reverse",
  pb: "pokeball",
  mb: "masterball",
};

export interface ParsedCatalogKey {
  pokemonTcgIoId: string;
  variant: string;
}

export function parseCatalogKey(key: string): ParsedCatalogKey {
  const match = CATALOG_KEY_PATTERN.exec(key);
  if (!match) {
    throw new Error(`"${key}" is not a catalog key (expected "<pokemontcg.io id>.<suffix>")`);
  }
  const pokemonTcgIoId = match[1] as string;
  const suffix = match[2] as string;
  const variant = SUFFIX_TO_VARIANT[suffix];
  if (!variant) {
    throw new Error(`Unknown variant suffix "${suffix}" in key "${key}"`);
  }
  return { pokemonTcgIoId, variant };
}

// The 25 special (non-catalog) items use human variant labels instead of the
// short suffixes above. Explicit map so an unrecognized label fails loudly
// instead of silently inventing a new variant string.
const SPECIAL_VARIANT_SLUGS: Record<string, string> = {
  Normal: "normal",
  Holo: "holo",
  "Reverse Holo": "reverse",
  Stamped: "stamped",
  "Stamped Holo": "stamped-holo",
  "Gold Border": "gold-border",
  "Jumbo (oversize)": "jumbo",
  "7 different jumbos": "jumbo-set",
  "Cosmos Holo": "cosmos-holo",
  "Cracked Ice Holo": "cracked-ice-holo",
  "Exclusive Holo": "exclusive-holo",
};

export function slugifySpecialVariant(label: string): string {
  const slug = SPECIAL_VARIANT_SLUGS[label];
  if (!slug) {
    throw new Error(`Unknown special variant label "${label}"`);
  }
  return slug;
}
