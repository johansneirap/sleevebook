import type { Currency } from "@sleevebook/binder-core";
import { convertFromUsd, sumVariantPricesUsd } from "@sleevebook/binder-core";
import { getBinderWithLayout, getVariantDisplays } from "../../../../lib/binders";
import { getGoalProgress } from "../../../../lib/goals";
import { getExchangeRates } from "../../../../lib/money";
import { getLatestPrices } from "../../../../lib/pricing";

// Shared by the "me faltan" page and its CSV route so both show the same rows.

export const SORT_OPTIONS = [
  { value: "binder", label: "Orden del binder" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "nombre", label: "Nombre" },
] as const;

export type MissingSort = (typeof SORT_OPTIONS)[number]["value"];

export function parseSort(raw: string | undefined): MissingSort {
  return SORT_OPTIONS.some((option) => option.value === raw) ? (raw as MissingSort) : "precio-desc";
}

export interface MissingRow {
  variantId: string;
  name: string;
  number: string;
  setName: string;
  variant: string;
  /** Market price in USD, null when we have no price point yet. */
  priceUsd: number | null;
  /** Same price in `MissingList.currency`, null when there is no price. */
  price: number | null;
}

export interface MissingList {
  binderId: string;
  binderName: string;
  /** Display currency actually used: the binder's, or USD when its rate is missing. */
  currency: Currency;
  /** The binder asks for a currency we have no rate for, so prices fall back to USD. */
  rateMissing: boolean;
  rateCapturedAt: string | null;
  rows: MissingRow[];
  objectiveValue: number;
  missingValue: number;
}

function comparePrice(a: MissingRow, b: MissingRow, direction: 1 | -1): number {
  // Cards without a price always go last, whatever the direction.
  if (a.priceUsd === null || b.priceUsd === null) {
    if (a.priceUsd === b.priceUsd) {
      return 0;
    }
    return a.priceUsd === null ? 1 : -1;
  }
  return (a.priceUsd - b.priceUsd) * direction;
}

function compareName(a: MissingRow, b: MissingRow): number {
  return a.name.localeCompare(b.name) || a.setName.localeCompare(b.setName);
}

export function sortRows(rows: MissingRow[], sort: MissingSort): MissingRow[] {
  const sorted = [...rows];
  if (sort === "precio-desc") {
    return sorted.sort(
      (a, b) => comparePrice(a, b, -1) || a.setName.localeCompare(b.setName) || compareName(a, b),
    );
  }
  if (sort === "precio-asc") {
    return sorted.sort(
      (a, b) => comparePrice(a, b, 1) || a.setName.localeCompare(b.setName) || compareName(a, b),
    );
  }
  if (sort === "nombre") {
    return sorted.sort(compareName);
  }
  // "binder": keep the goal's variant order.
  return sorted;
}

export async function loadMissingList(
  binderId: string,
  sort: MissingSort,
): Promise<MissingList | null> {
  const progress = await getGoalProgress(binderId);
  if (!progress) {
    return null;
  }
  const binderData = await getBinderWithLayout(binderId);
  if (!binderData) {
    return null;
  }

  const displays = await getVariantDisplays(progress.missingVariantIds);
  const prices = await getLatestPrices(progress.allVariantIds);
  const priceLookup = Object.fromEntries(
    Object.entries(prices).map(([id, price]) => [id, price.amountUsd]),
  );

  const { rates, capturedAt } = await getExchangeRates();
  const rateMissing =
    binderData.currency !== "usd" && convertFromUsd(1, binderData.currency, rates) === undefined;
  const currency: Currency = rateMissing ? "usd" : binderData.currency;
  const toDisplay = (usd: number) => convertFromUsd(usd, currency, rates) ?? usd;

  // progress.missingVariantIds keeps the goal's order, which is the "binder" order.
  const rows: MissingRow[] = [];
  for (const id of progress.missingVariantIds) {
    const display = displays.get(id);
    if (!display) {
      continue;
    }
    const priceUsd = prices[id]?.amountUsd ?? null;
    rows.push({
      variantId: id,
      name: display.name,
      number: display.number,
      setName: display.setName,
      variant: display.variant,
      priceUsd,
      price: priceUsd === null ? null : toDisplay(priceUsd),
    });
  }

  return {
    binderId,
    binderName: binderData.name,
    currency,
    rateMissing,
    rateCapturedAt: rateMissing ? null : capturedAt,
    rows: sortRows(rows, sort),
    objectiveValue: toDisplay(sumVariantPricesUsd(progress.allVariantIds, priceLookup)),
    missingValue: toDisplay(sumVariantPricesUsd(progress.missingVariantIds, priceLookup)),
  };
}
