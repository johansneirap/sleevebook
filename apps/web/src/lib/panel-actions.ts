"use server";

import {
  coveredPockets,
  formatPocketCode,
  layoutSchema,
  type Panel,
  PanelOutOfBoundsError,
  PanelOverlapError,
  parsePocketCode,
  validatePanels,
} from "@sleevebook/binder-core";
import { binder, binderVersion } from "@sleevebook/db";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import type { PocketValue } from "./pocket-actions";
import { assertBinderOwner } from "./session";

export interface AddPanelInput {
  assetUrl: string;
  anchorCode: string;
  rows: number;
  cols: number;
  zoom: number;
  x: number;
  y: number;
}

export type PanelActionResult = { ok: true } | { ok: false; error: string };

export async function addPanel(binderId: string, input: AddPanelInput): Promise<PanelActionResult> {
  await assertBinderOwner(binderId);
  const [binderRow] = await db.select().from(binder).where(eq(binder.id, binderId));
  if (!binderRow) {
    return { ok: false, error: "Binder no encontrado" };
  }

  const [versionRow] = await db
    .select({ id: binderVersion.id, layout: binderVersion.layout })
    .from(binderVersion)
    .where(eq(binderVersion.binderId, binderId))
    .orderBy(desc(binderVersion.versionNumber))
    .limit(1);
  if (!versionRow) {
    return { ok: false, error: "No hay layout para este binder" };
  }

  const layout = layoutSchema.parse(versionRow.layout);
  const format = { rows: binderRow.formatRows, cols: binderRow.formatCols };

  let anchor: ReturnType<typeof parsePocketCode>;
  try {
    anchor = parsePocketCode(input.anchorCode);
  } catch {
    return { ok: false, error: `Código de bolsillo inválido: ${input.anchorCode}` };
  }

  const panelId = crypto.randomUUID();
  const candidate: Panel = { id: panelId, anchor, span: { rows: input.rows, cols: input.cols } };

  let covered: ReturnType<typeof coveredPockets>;
  try {
    covered = coveredPockets(candidate, format);
    const existingPanels: Panel[] = layout.panels.map((p) => ({
      id: p.id,
      anchor: parsePocketCode(p.anchor),
      span: p.span,
    }));
    // validatePanels re-checks bounds for every panel including the new one;
    // cheap at this scale (a handful of panels per binder) and keeps the
    // bounds/overlap rules in exactly one place (binder-core).
    validatePanels([...existingPanels, candidate], format);
  } catch (error) {
    if (error instanceof PanelOutOfBoundsError) {
      return { ok: false, error: "El panel no entra en esa posición dentro de la cara." };
    }
    if (error instanceof PanelOverlapError) {
      return { ok: false, error: "El panel se superpone con otro panel existente." };
    }
    throw error;
  }

  const coveredCodes = covered.map((pocket) => formatPocketCode(pocket));
  for (const code of coveredCodes) {
    const existing = layout.pockets[code] ?? { kind: "empty" };
    if (existing.kind !== "empty") {
      return {
        ok: false,
        error: `El bolsillo ${code} ya tiene contenido. Vacía esos bolsillos antes de poner un panel ahí.`,
      };
    }
  }

  const pockets: Record<string, PocketValue> = { ...layout.pockets };
  for (const code of coveredCodes) {
    pockets[code] = { kind: "panel", panelId };
  }

  const updatedLayout = layoutSchema.parse({
    ...layout,
    panels: [
      ...layout.panels,
      {
        id: panelId,
        asset: input.assetUrl,
        anchor: input.anchorCode,
        span: { rows: input.rows, cols: input.cols },
        crop: { x: input.x, y: input.y, zoom: input.zoom },
        seamMm: 0,
      },
    ],
    pockets,
  });

  await db
    .update(binderVersion)
    .set({ layout: updatedLayout })
    .where(eq(binderVersion.id, versionRow.id));

  revalidatePath(`/binders/${binderId}`);
  revalidatePath(`/binders/${binderId}/editar`);
  return { ok: true };
}

export async function removePanel(binderId: string, panelId: string): Promise<void> {
  await assertBinderOwner(binderId);
  const [versionRow] = await db
    .select({ id: binderVersion.id, layout: binderVersion.layout })
    .from(binderVersion)
    .where(eq(binderVersion.binderId, binderId))
    .orderBy(desc(binderVersion.versionNumber))
    .limit(1);
  if (!versionRow) {
    return;
  }

  const layout = layoutSchema.parse(versionRow.layout);
  const pockets: Record<string, PocketValue> = { ...layout.pockets };
  for (const [code, content] of Object.entries(pockets)) {
    if (content.kind === "panel" && content.panelId === panelId) {
      pockets[code] = { kind: "empty" };
    }
  }

  const updatedLayout = layoutSchema.parse({
    ...layout,
    panels: layout.panels.filter((p) => p.id !== panelId),
    pockets,
  });

  await db
    .update(binderVersion)
    .set({ layout: updatedLayout })
    .where(eq(binderVersion.id, versionRow.id));

  revalidatePath(`/binders/${binderId}`);
  revalidatePath(`/binders/${binderId}/editar`);
}
