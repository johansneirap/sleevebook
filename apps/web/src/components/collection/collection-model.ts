import {
  COPY_LANGUAGES,
  type CopyValueOrigin,
  conditionLabel,
  gradingLabel,
  languageChip,
  languageLabel,
} from "@sleevebook/binder-core";
import type { CollectionEntry } from "../../lib/collection";

// Pure view rules for "Mi colección": filters, sorting and grouping of copies.
// Used by the server page (which formats money). No I/O here.

export const SORT_KEYS = ["recientes", "nombre", "valor"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export interface CollectionFilters {
  q: string;
  language: string;
  condition: string;
  graded: "" | "si" | "no";
  where: "" | "binder" | "loose";
  sort: SortKey;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseFilters(params: SearchParams): CollectionFilters {
  const sortParam = first(params.sort);
  const graded = first(params.graded);
  const where = first(params.where);
  const lang = first(params.lang);
  return {
    q: first(params.q).slice(0, 80),
    language: COPY_LANGUAGES.some((l) => l.code === lang) ? lang : "",
    condition: first(params.cond),
    graded: graded === "si" || graded === "no" ? graded : "",
    where: where === "binder" || where === "loose" ? where : "",
    sort: (SORT_KEYS as readonly string[]).includes(sortParam)
      ? (sortParam as SortKey)
      : "recientes",
  };
}

export function filterEntries(
  entries: CollectionEntry[],
  filters: CollectionFilters,
): CollectionEntry[] {
  const query = filters.q.toLocaleLowerCase("es");
  return entries.filter(({ copy, display, placement }) => {
    if (query) {
      const haystack = `${display?.name ?? ""} ${display?.setName ?? ""}`.toLocaleLowerCase("es");
      if (!haystack.includes(query)) {
        return false;
      }
    }
    if (filters.language && copy.language !== filters.language) {
      return false;
    }
    if (filters.condition && copy.condition !== filters.condition) {
      return false;
    }
    const graded = gradingLabel(copy) !== null;
    if ((filters.graded === "si" && !graded) || (filters.graded === "no" && graded)) {
      return false;
    }
    if (filters.where === "binder" && !placement) {
      return false;
    }
    if (filters.where === "loose" && placement) {
      return false;
    }
    return true;
  });
}

/** Copy fields the edit dialog needs, as plain strings. */
export interface CopyFormValues {
  id: string;
  variantId: string;
  language: string;
  condition: string;
  gradingCompany: string;
  gradingGrade: string;
  purchasePrice: string;
  purchaseCurrency: string;
  valueUsd: string;
  notes: string;
  acquiredAt: string;
}

export interface CopyGroupRow {
  key: string;
  copyIds: string[];
  count: number;
  name: string;
  setName: string;
  number: string;
  variant: string;
  imageUrl: string | null;
  chip: string;
  languageLabel: string;
  conditionLabel: string;
  grading: string | null;
  /** Formatted value of the whole group ("$4.20 USD" or "sin precio"). */
  valueText: string;
  valueHint: string | null;
  /** Binder and pocket of the copy; null when loose. */
  placement: { binderId: string; binderName: string; pocketCode: string } | null;
  notes: string | null;
  form: CopyFormValues;
  amountUsd: number | null;
  sortName: string;
}

const ORIGIN_HINT: Record<CopyValueOrigin, string> = {
  manual: "valor propio",
  condicion: "estimado por condición",
  mercado: "precio de mercado NM",
  referencia: "referencia NM",
};

export function valueHintFor(origin: CopyValueOrigin | undefined): string | null {
  return origin === undefined ? null : ORIGIN_HINT[origin];
}

function groupKey(entry: CollectionEntry): string {
  const { copy, placement } = entry;
  const base = [
    copy.variantId,
    copy.language,
    copy.condition,
    copy.gradingCompany ?? "",
    copy.gradingGrade ?? "",
    copy.valueUsd ?? "",
  ];
  // Copies in a pocket are individual rows; identical loose copies are grouped.
  return placement ? [...base, `pocket:${copy.id}`].join("|") : [...base, "loose"].join("|");
}

function formValues(entry: CollectionEntry): CopyFormValues {
  const { copy } = entry;
  return {
    id: copy.id,
    variantId: copy.variantId,
    language: copy.language,
    condition: copy.condition,
    gradingCompany: copy.gradingCompany ?? "",
    gradingGrade: copy.gradingGrade === null ? "" : String(copy.gradingGrade),
    purchasePrice: copy.purchasePrice === null ? "" : String(copy.purchasePrice),
    purchaseCurrency: copy.purchaseCurrency,
    valueUsd: copy.valueUsd === null ? "" : String(copy.valueUsd),
    notes: copy.notes ?? "",
    acquiredAt: copy.acquiredAt ?? "",
  };
}

/**
 * Groups filtered entries into rows and sorts them. `formatUsd` formats a USD
 * amount for the viewer (null means "sin precio").
 */
export function buildGroupRows(
  entries: CollectionEntry[],
  filters: CollectionFilters,
  formatUsd: (amountUsd: number | null) => string,
): CopyGroupRow[] {
  const groups = new Map<string, CollectionEntry[]>();
  for (const entry of entries) {
    const key = groupKey(entry);
    const list = groups.get(key);
    if (list) {
      list.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  const rows = [...groups.entries()].map(([key, members]): CopyGroupRow => {
    const head = members[0];
    if (!head) {
      throw new Error("Grupo vacío");
    }
    const { copy, display, value, placement } = head;
    const priced = members.filter((m) => m.value !== undefined);
    const amount =
      priced.length === 0
        ? null
        : Math.round(priced.reduce((sum, m) => sum + (m.value?.amountUsd ?? 0), 0) * 100) / 100;
    return {
      key,
      copyIds: members.map((m) => m.copy.id),
      count: members.length,
      name: display?.name ?? "Carta sin datos",
      setName: display?.setName ?? "",
      number: display?.number ?? "",
      variant: display?.variant ?? "",
      imageUrl: display?.imageUrl ?? null,
      chip: languageChip(copy.language),
      languageLabel: languageLabel(copy.language),
      conditionLabel: conditionLabel(copy.condition),
      grading: gradingLabel(copy),
      valueText: formatUsd(amount),
      valueHint: valueHintFor(value?.origin),
      placement: placement
        ? {
            binderId: placement.binderId,
            binderName: placement.binderName,
            pocketCode: placement.pocketCode,
          }
        : null,
      notes: copy.notes,
      form: formValues(head),
      amountUsd: amount,
      sortName: `${display?.name ?? ""} ${display?.number ?? ""}`,
    };
  });

  if (filters.sort === "nombre") {
    rows.sort((a, b) => a.sortName.localeCompare(b.sortName, "es"));
  } else if (filters.sort === "valor") {
    rows.sort((a, b) => (b.amountUsd ?? -1) - (a.amountUsd ?? -1));
  }
  return rows;
}
