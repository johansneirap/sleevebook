"use server";

import {
  type SortKey as CoreSortKey,
  capacity,
  formatPocketCode,
  layoutSchema,
  pocketCodeFromGlobalIndex,
  sectionize,
  sortPockets,
} from "@sleevebook/binder-core";
import { binder, binderVersion, card, cardVariant, set } from "@sleevebook/db";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import type { PocketValue } from "./pocket-actions";

export type SortableField =
  | "era"
  | "releasedAt"
  | "setName"
  | "number"
  | "name"
  | "rarity"
  | "variant";
export type GroupField = "era" | "setName";

export interface SortCriterion {
  field: SortableField;
  dir: "asc" | "desc";
}

export interface SortOptions {
  criteria: SortCriterion[];
  groupBy: GroupField | null;
  startOnNewSide: boolean;
}

export type SortResult =
  | { ok: true; pockets: Record<string, PocketValue> }
  | { ok: false; error: string };

interface SortableItem {
  content: PocketValue;
  era: string;
  releasedAt: string;
  setName: string;
  number: string;
  name: string;
  rarity: string;
  variant: string;
}

const EMPTY_POCKET: PocketValue = { kind: "empty" };

function fieldToCoreKey(criterion: SortCriterion): CoreSortKey<SortableItem> {
  return {
    get: (item) => item[criterion.field],
    dir: criterion.dir,
    type: criterion.field === "number" ? "cardNumber" : "string",
  };
}

export async function computeSortedLayout(
  binderId: string,
  options: SortOptions,
): Promise<SortResult> {
  const [binderRow] = await db.select().from(binder).where(eq(binder.id, binderId));
  if (!binderRow) {
    return { ok: false, error: "Binder no encontrado" };
  }

  const [versionRow] = await db
    .select({ layout: binderVersion.layout })
    .from(binderVersion)
    .where(eq(binderVersion.binderId, binderId))
    .orderBy(desc(binderVersion.versionNumber))
    .limit(1);
  if (!versionRow) {
    return { ok: false, error: "No hay layout para este binder" };
  }

  const layout = layoutSchema.parse(versionRow.layout);
  const format = { rows: binderRow.formatRows, cols: binderRow.formatCols };
  const sheets = binderRow.sheets;

  const occupied = Object.entries(layout.pockets).filter(
    ([, content]) => content.kind === "card" || content.kind === "placeholder",
  ) as Array<[string, Extract<PocketValue, { kind: "card" | "placeholder" }>]>;

  const variantIds = [...new Set(occupied.map(([, content]) => content.variant))];
  const infoById = new Map<
    string,
    {
      era: string;
      releasedAt: string;
      setName: string;
      number: string;
      name: string;
      rarity: string;
    }
  >();

  if (variantIds.length > 0) {
    const rows = await db
      .select({
        id: cardVariant.id,
        number: card.number,
        name: card.name,
        rarity: card.rarity,
        setName: set.name,
        era: set.era,
        releasedAt: set.releasedAt,
      })
      .from(cardVariant)
      .innerJoin(card, eq(card.id, cardVariant.cardId))
      .innerJoin(set, eq(set.id, card.setId))
      .where(inArray(cardVariant.id, variantIds));

    for (const row of rows) {
      infoById.set(row.id, {
        era: row.era ?? "",
        releasedAt: row.releasedAt ?? "",
        setName: row.setName,
        number: row.number,
        name: row.name,
        rarity: row.rarity ?? "",
      });
    }
  }

  const items: SortableItem[] = occupied.map(([, content]) => {
    const info = infoById.get(content.variant);
    return {
      content,
      era: info?.era ?? "",
      releasedAt: info?.releasedAt ?? "",
      setName: info?.setName ?? "",
      number: info?.number ?? "",
      name: info?.name ?? "",
      rarity: info?.rarity ?? "",
      variant: content.variant,
    };
  });

  const criteria = options.groupBy
    ? [{ field: options.groupBy, dir: "asc" as const }, ...options.criteria]
    : options.criteria;
  const sorted = sortPockets(items, criteria.map(fieldToCoreKey));

  const sections = options.groupBy
    ? sectionize(sorted, (item) => item[options.groupBy as GroupField], {
        startOnNewSide: options.startOnNewSide,
      })
    : [{ key: "", items: sorted, startOnNewSide: false }];

  const pocketsPerFace = format.rows * format.cols;
  const ordered: PocketValue[] = [];
  for (const section of sections) {
    if (section.startOnNewSide && ordered.length > 0 && ordered.length % pocketsPerFace !== 0) {
      const padCount = pocketsPerFace - (ordered.length % pocketsPerFace);
      for (let i = 0; i < padCount; i++) {
        ordered.push(EMPTY_POCKET);
      }
    }
    for (const item of section.items) {
      ordered.push(item.content);
    }
  }

  const totalCapacity = capacity(format, sheets);
  if (ordered.length > totalCapacity) {
    return {
      ok: false,
      error: `No entran todas las cartas con este agrupamiento: necesita ${ordered.length} bolsillos y el binder tiene ${totalCapacity}. Aumentá las hojas o desactivá "empezar en cara nueva".`,
    };
  }
  while (ordered.length < totalCapacity) {
    ordered.push(EMPTY_POCKET);
  }

  const pockets: Record<string, PocketValue> = {};
  for (let i = 0; i < totalCapacity; i++) {
    const code = formatPocketCode(pocketCodeFromGlobalIndex(i, format));
    pockets[code] = ordered[i] ?? EMPTY_POCKET;
  }

  return { ok: true, pockets };
}
