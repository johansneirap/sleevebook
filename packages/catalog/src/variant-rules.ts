export type Variant = "normal" | "holo" | "reverse" | "pokeball" | "masterball";

export interface VariantRuleInput {
  rarity?: string;
  setName: string;
  releasedAt?: string;
}

export interface VariantRuleOptions {
  /** A set is "very recent" (unconfirmed variants) within this many days of release. */
  recentDays?: number;
  now?: Date;
}

export interface DerivedVariants {
  variants: Variant[];
  needsReview: boolean;
}

const NORMAL_RARITIES = new Set(["Common", "Uncommon", "Rare"]);

// Sets printed without a reverse holo pass over their base rarities.
const NO_REVERSE_SET_NAMES = [
  "POP Series",
  "Pokémon Rumble",
  "McDonald's",
  "Hidden Fates Shiny Vault",
  "Crown Zenith Galarian Gallery",
];

// Sets that replace the reverse holo slot with Poké Ball / Master Ball patterns.
const POKEBALL_MASTERBALL_SET_NAMES = ["Prismatic Evolutions", "White Flare", "Black Bolt"];

const DEFAULT_RECENT_DAYS = 90;

function baseVariant(rarity: string | undefined): Variant {
  if (!rarity || NORMAL_RARITIES.has(rarity)) {
    return "normal";
  }
  return "holo";
}

function isEligibleForReverseLike(rarity: string | undefined): boolean {
  return rarity !== undefined && (NORMAL_RARITIES.has(rarity) || rarity === "Rare Holo");
}

function additionalVariants(input: VariantRuleInput): Variant[] {
  if (!isEligibleForReverseLike(input.rarity)) {
    return [];
  }
  if (NO_REVERSE_SET_NAMES.some((name) => input.setName.includes(name))) {
    return [];
  }
  if (POKEBALL_MASTERBALL_SET_NAMES.includes(input.setName)) {
    return ["pokeball", "masterball"];
  }
  return ["reverse"];
}

function isRecentSet(releasedAt: string | undefined, options: VariantRuleOptions): boolean {
  if (!releasedAt) {
    return false;
  }
  const now = options.now ?? new Date();
  const recentDays = options.recentDays ?? DEFAULT_RECENT_DAYS;
  const ageInDays = (now.getTime() - new Date(releasedAt).getTime()) / (24 * 60 * 60 * 1000);
  return ageInDays < recentDays;
}

export function deriveVariants(
  input: VariantRuleInput,
  options: VariantRuleOptions = {},
): DerivedVariants {
  const variants = [baseVariant(input.rarity), ...additionalVariants(input)];
  const needsReview = !input.rarity || isRecentSet(input.releasedAt, options);
  return { variants, needsReview };
}
