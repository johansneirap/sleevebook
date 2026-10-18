import { type Layout, layoutSchema } from "@sleevebook/binder-core";
import { binderTemplate, user } from "@sleevebook/db";
import { desc, eq, or } from "drizzle-orm";
import { db } from "./db";

// Plantillas: a binder's design (format, opening, sheets, theme, panels and
// sections). Never cards. The fragments are validated with the layoutSchema
// pieces so a malformed row can't break the pages that render it.
const fragmentSchema = layoutSchema.pick({ theme: true, panels: true, sections: true });

export type TemplateFragment = Pick<Layout, "theme" | "panels" | "sections">;

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  formatRows: number;
  formatCols: number;
  opening: "side" | "top";
  sheets: number;
  usesCount: number;
  createdAt: Date;
  author: { id: string; name: string; handle: string };
  isOwn: boolean;
  fragment: TemplateFragment;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseFragment(row: {
  theme: unknown;
  panels: unknown;
  sections: unknown;
}): TemplateFragment | null {
  const parsed = fragmentSchema.safeParse({
    theme: row.theme,
    panels: row.panels ?? [],
    sections: row.sections ?? [],
  });
  return parsed.success ? parsed.data : null;
}

function toSummary(
  row: {
    id: string;
    authorId: string;
    name: string;
    description: string | null;
    visibility: string;
    formatRows: number;
    formatCols: number;
    opening: string;
    sheets: number;
    usesCount: number;
    createdAt: Date;
    authorName: string;
    authorHandle: string;
  },
  fragment: TemplateFragment,
  viewerId: string | null,
): TemplateSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility === "private" ? "private" : "public",
    formatRows: row.formatRows,
    formatCols: row.formatCols,
    opening: row.opening === "top" ? "top" : "side",
    sheets: row.sheets,
    usesCount: row.usesCount,
    createdAt: row.createdAt,
    author: { id: row.authorId, name: row.authorName, handle: row.authorHandle },
    isOwn: viewerId !== null && row.authorId === viewerId,
    fragment,
  };
}

const selectColumns = {
  id: binderTemplate.id,
  authorId: user.id,
  name: binderTemplate.name,
  description: binderTemplate.description,
  visibility: binderTemplate.visibility,
  formatRows: binderTemplate.formatRows,
  formatCols: binderTemplate.formatCols,
  opening: binderTemplate.opening,
  sheets: binderTemplate.sheets,
  usesCount: binderTemplate.usesCount,
  createdAt: binderTemplate.createdAt,
  theme: binderTemplate.theme,
  panels: binderTemplate.panels,
  sections: binderTemplate.sections,
  authorName: user.name,
  authorHandle: user.handle,
};

/**
 * Public templates, plus the viewer's own private ones when `mine` is given.
 * Rows whose stored design fails validation are left out.
 */
export async function listTemplates(
  options: { mine?: string | null } = {},
): Promise<TemplateSummary[]> {
  const mine = options.mine ?? null;
  const rows = await db
    .select(selectColumns)
    .from(binderTemplate)
    .innerJoin(user, eq(user.id, binderTemplate.userId))
    .where(
      mine
        ? or(eq(binderTemplate.visibility, "public"), eq(binderTemplate.userId, mine))
        : eq(binderTemplate.visibility, "public"),
    )
    .orderBy(desc(binderTemplate.createdAt));

  const result: TemplateSummary[] = [];
  for (const row of rows) {
    const fragment = parseFragment(row);
    if (fragment) {
      result.push(toSummary(row, fragment, mine));
    }
  }
  return result;
}

/** One template, or null when it doesn't exist or is private to someone else. */
export async function getTemplate(
  id: string,
  viewerId: string | null,
): Promise<TemplateSummary | null> {
  if (!UUID_RE.test(id)) {
    return null;
  }
  const [row] = await db
    .select(selectColumns)
    .from(binderTemplate)
    .innerJoin(user, eq(user.id, binderTemplate.userId))
    .where(eq(binderTemplate.id, id));
  if (!row) {
    return null;
  }
  const isOwn = viewerId !== null && row.authorId === viewerId;
  if (row.visibility !== "public" && !isOwn) {
    return null;
  }
  const fragment = parseFragment(row);
  return fragment ? toSummary(row, fragment, viewerId) : null;
}
