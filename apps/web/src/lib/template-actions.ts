"use server";

import {
  coveredPockets,
  createEmptyLayout,
  formatPocketCode,
  layoutSchema,
  type Panel,
  parsePocketCode,
  validatePanels,
} from "@sleevebook/binder-core";
import { binder, binderTemplate, binderVersion } from "@sleevebook/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./db";
import { assertBinderOwner, assertUser } from "./session";
import { getTemplate } from "./templates";

export type SaveTemplateField = "name" | "description" | "visibility";

export interface SaveTemplateState {
  errors: Partial<Record<SaveTemplateField, string>>;
  message?: string;
}

const NAME_MAX = 60;
const DESCRIPTION_MAX = 280;

/** Captures a binder's design as a template. Never copies its cards. */
export async function saveAsTemplate(
  _previous: SaveTemplateState,
  formData: FormData,
): Promise<SaveTemplateState> {
  const binderId = String(formData.get("binderId") ?? "");
  const owner = await assertBinderOwner(binderId);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const visibilityRaw = String(formData.get("visibility") ?? "");

  const errors: SaveTemplateState["errors"] = {};
  if (name.length < 1 || name.length > NAME_MAX) {
    errors.name = `El nombre debe tener entre 1 y ${NAME_MAX} caracteres.`;
  }
  if (description.length > DESCRIPTION_MAX) {
    errors.description = `La descripción no puede superar ${DESCRIPTION_MAX} caracteres.`;
  }
  if (visibilityRaw !== "public" && visibilityRaw !== "private") {
    errors.visibility = "Elige si la plantilla es pública o privada.";
  }
  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const [binderRow] = await db.select().from(binder).where(eq(binder.id, binderId));
  if (!binderRow) {
    return { errors: {}, message: "No encontramos este binder." };
  }
  const [versionRow] = await db
    .select({ layout: binderVersion.layout })
    .from(binderVersion)
    .where(eq(binderVersion.binderId, binderId))
    .orderBy(desc(binderVersion.versionNumber))
    .limit(1);
  if (!versionRow) {
    return { errors: {}, message: "Este binder no tiene diseño guardado." };
  }
  const layout = layoutSchema.parse(versionRow.layout);

  const [created] = await db
    .insert(binderTemplate)
    .values({
      userId: owner.id,
      name,
      description: description.length > 0 ? description : null,
      formatRows: binderRow.formatRows,
      formatCols: binderRow.formatCols,
      opening: binderRow.opening,
      sheets: binderRow.sheets,
      theme: layout.theme,
      panels: layout.panels,
      sections: layout.sections,
      visibility: visibilityRaw,
    })
    .returning({ id: binderTemplate.id });
  const templateId = (created as { id: string }).id;

  revalidatePath("/plantillas");
  redirect(`/plantillas?nueva=${templateId}`);
}

/**
 * Creates a new binder for the viewer from a public template (or their own
 * private one). The layout gets the template's theme, panels and sections; the
 * panel pockets are rebuilt exactly like panel-actions does, and no card pockets
 * are copied.
 */
export async function useTemplate(templateId: string): Promise<void> {
  const viewer = await assertUser();
  const template = await getTemplate(templateId, viewer.id);
  if (!template) {
    throw new Error("Plantilla no encontrada");
  }

  const format = { rows: template.formatRows, cols: template.formatCols };
  const { fragment } = template;
  const panels: Panel[] = fragment.panels.map((p) => ({
    id: p.id,
    anchor: parsePocketCode(p.anchor),
    span: p.span,
  }));
  validatePanels(panels, format);

  const empty = createEmptyLayout(format, template.sheets, template.opening);
  const pockets = { ...empty.pockets };
  for (const panel of panels) {
    for (const pocket of coveredPockets(panel, format)) {
      pockets[formatPocketCode(pocket)] = { kind: "panel", panelId: panel.id };
    }
  }

  const layout = layoutSchema.parse({
    ...empty,
    theme: fragment.theme,
    panels: fragment.panels,
    sections: fragment.sections,
    pockets,
  });

  const [created] = await db
    .insert(binder)
    .values({
      userId: viewer.id,
      name: template.name,
      formatRows: template.formatRows,
      formatCols: template.formatCols,
      opening: template.opening,
      loading: "side",
      sheets: template.sheets,
      status: "draft",
    })
    .returning({ id: binder.id });
  const binderId = (created as { id: string }).id;

  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout });
  await db
    .update(binderTemplate)
    .set({ usesCount: sql`${binderTemplate.usesCount} + 1` })
    .where(eq(binderTemplate.id, templateId));

  revalidatePath("/binders");
  revalidatePath("/plantillas");
  redirect(`/binders/${binderId}/editar`);
}

/** Form-action adapter for useTemplate (the template id comes in a hidden field). */
export async function useTemplateForm(formData: FormData): Promise<void> {
  await useTemplate(String(formData.get("templateId") ?? ""));
}

/** Deletes a template. Only its author can. */
export async function deleteTemplate(templateId: string): Promise<void> {
  const viewer = await assertUser();
  await db
    .delete(binderTemplate)
    .where(and(eq(binderTemplate.id, templateId), eq(binderTemplate.userId, viewer.id)));
  revalidatePath("/plantillas");
}

/** Form-action adapter for deleteTemplate. */
export async function deleteTemplateForm(formData: FormData): Promise<void> {
  await deleteTemplate(String(formData.get("templateId") ?? ""));
}
