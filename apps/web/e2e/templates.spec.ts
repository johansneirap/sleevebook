import { expect, test } from "@playwright/test";
import {
  createEmptyLayout,
  formatPocketCode,
  type Layout,
  layoutSchema,
} from "@sleevebook/binder-core";
import {
  binder,
  binderTemplate,
  binderVersion,
  cardVariant,
  createDb,
  DEV_USER_ID,
  ensureDevUser,
} from "@sleevebook/db";
import { and, desc, eq, like } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

const RUN_TAG = `f4e-${Date.now()}`;
const SOURCE_NAME = `F4E Origen ${RUN_TAG}`;
const TEMPLATE_NAME = `F4E Diseño ${RUN_TAG}`;
const PRIVATE_NAME = `F4E Privada ${RUN_TAG}`;
const PANEL_ASSET = "/e2e-f4e-panel.png";

let sourceBinderId: string;
let privateTemplateId: string;
let createdBinderId: string | null = null;

test.beforeAll(async () => {
  await ensureDevUser(db);
  const [variant] = await db.select({ id: cardVariant.id }).from(cardVariant).limit(1);
  if (!variant) {
    throw new Error("No hay variantes en el catálogo para el fixture");
  }

  // Source binder: 2×2, 2 sheets, vintage theme, one panel over 2 pockets and one card pocket.
  const base = createEmptyLayout({ rows: 2, cols: 2 }, 2);
  const panelId = crypto.randomUUID();
  const pockets = { ...base.pockets };
  pockets[formatPocketCode({ sheet: 1, side: "F", index: 1 })] = { kind: "panel", panelId };
  pockets[formatPocketCode({ sheet: 1, side: "F", index: 2 })] = { kind: "panel", panelId };
  pockets[formatPocketCode({ sheet: 1, side: "F", index: 3 })] = {
    kind: "card",
    variant: variant.id,
    instance: null,
  };
  const layout = layoutSchema.parse({
    ...base,
    theme: { preset: "vintage", sleeve: "clear" },
    panels: [
      {
        id: panelId,
        asset: PANEL_ASSET,
        anchor: formatPocketCode({ sheet: 1, side: "F", index: 1 }),
        span: { rows: 1, cols: 2 },
        crop: { x: 0, y: 0, zoom: 1 },
        seamMm: 0,
      },
    ],
    pockets,
  });

  const [row] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: SOURCE_NAME,
      formatRows: 2,
      formatCols: 2,
      sheets: 2,
      status: "draft",
    })
    .returning({ id: binder.id });
  sourceBinderId = (row as { id: string }).id;
  await db.insert(binderVersion).values({ binderId: sourceBinderId, versionNumber: 1, layout });

  // A private template of the dev user, to check it stays hidden from visitors.
  const [privateRow] = await db
    .insert(binderTemplate)
    .values({
      userId: DEV_USER_ID,
      name: PRIVATE_NAME,
      formatRows: 2,
      formatCols: 2,
      opening: "side",
      sheets: 1,
      theme: { preset: "neon", sleeve: "matte" },
      panels: [],
      sections: [],
      visibility: "private",
    })
    .returning({ id: binderTemplate.id });
  privateTemplateId = (privateRow as { id: string }).id;
});

test.afterAll(async () => {
  await db.delete(binderTemplate).where(like(binderTemplate.name, "F4E%"));
  await db.delete(binder).where(like(binder.name, "F4E%"));
  await db.$client.end();
});

test.describe
  .serial("plantillas", () => {
    test("guardar un binder como plantilla pública y usarla", async ({ page }) => {
      await page.goto(`/binders/${sourceBinderId}/plantilla`);
      await expect(page.getByLabel("Nombre")).toHaveValue(`F4E Origen ${RUN_TAG} (diseño)`);
      await page.getByLabel("Nombre").fill(TEMPLATE_NAME);
      await page.getByLabel("Descripción (opcional)").fill("Plantilla de prueba E2E");
      await page.getByRole("radio", { name: "Pública" }).check();
      await page.getByRole("button", { name: "Guardar como plantilla" }).click();

      await expect(page).toHaveURL(/\/plantillas\?nueva=[0-9a-f-]{36}$/);
      const templateId = new URL(page.url()).searchParams.get("nueva") as string;

      const card = page
        .getByRole("listitem")
        .filter({ has: page.getByRole("heading", { name: TEMPLATE_NAME, exact: true }) });
      await expect(card).toBeVisible();
      await expect(card).toContainText("Usada 0 veces");

      await card.getByRole("button", { name: "Usar plantilla" }).click();
      await expect(page).toHaveURL(/\/binders\/[0-9a-f-]{36}\/editar$/);
      createdBinderId = new URL(page.url()).pathname.split("/")[2] as string;

      // The new binder keeps the design but not the cards.
      const [created] = await db
        .select({ name: binder.name, formatRows: binder.formatRows, sheets: binder.sheets })
        .from(binder)
        .where(eq(binder.id, createdBinderId));
      expect(created).toMatchObject({ name: TEMPLATE_NAME, formatRows: 2, sheets: 2 });

      const [version] = await db
        .select({ layout: binderVersion.layout })
        .from(binderVersion)
        .where(eq(binderVersion.binderId, createdBinderId))
        .orderBy(desc(binderVersion.versionNumber))
        .limit(1);
      const newLayout = layoutSchema.parse(version?.layout) as Layout;
      expect(newLayout.theme.preset).toBe("vintage");
      expect(newLayout.panels).toHaveLength(1);
      expect(newLayout.panels[0]?.asset).toBe(PANEL_ASSET);
      const panelId = newLayout.panels[0]?.id as string;
      const values = Object.values(newLayout.pockets);
      expect(values.filter((value) => value.kind === "card")).toHaveLength(0);
      expect(
        values.filter((value) => value.kind === "panel" && value.panelId === panelId),
      ).toHaveLength(2);
      expect(newLayout.pockets[formatPocketCode({ sheet: 1, side: "F", index: 1 })]).toEqual({
        kind: "panel",
        panelId,
      });
      expect(newLayout.pockets[formatPocketCode({ sheet: 1, side: "F", index: 2 })]).toEqual({
        kind: "panel",
        panelId,
      });

      const [template] = await db
        .select({ usesCount: binderTemplate.usesCount })
        .from(binderTemplate)
        .where(and(eq(binderTemplate.id, templateId), eq(binderTemplate.userId, DEV_USER_ID)));
      expect(template?.usesCount).toBe(1);
    });

    test("la galería muestra la plantilla privada solo a su autor", async ({ page }) => {
      await page.goto("/plantillas");
      await expect(page.getByRole("heading", { name: "Plantillas", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: TEMPLATE_NAME, exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: PRIVATE_NAME, exact: true })).toBeVisible();

      await page.getByRole("link", { name: "Mías", exact: true }).click();
      await expect(page).toHaveURL(/vista=mias$/);
      await expect(page.getByRole("heading", { name: PRIVATE_NAME, exact: true })).toBeVisible();
    });

    test("el autor puede eliminar su plantilla", async ({ page }) => {
      await page.goto("/plantillas?vista=mias");
      const card = page
        .getByRole("listitem")
        .filter({ has: page.getByRole("heading", { name: PRIVATE_NAME, exact: true }) });
      // "Eliminar" asks for confirmation first.
      page.once("dialog", (dialog) => dialog.accept());
      await card.getByRole("button", { name: "Eliminar" }).click();
      await expect(page.getByRole("heading", { name: PRIVATE_NAME, exact: true })).toHaveCount(0);
      await db.delete(binderTemplate).where(eq(binderTemplate.id, privateTemplateId));
    });
  });

test.describe("visitante sin sesión", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("ve las plantillas públicas, no las privadas, y 'Usar' pide entrar", async ({ page }) => {
    await page.goto("/plantillas");
    await expect(page.getByRole("heading", { name: TEMPLATE_NAME, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: PRIVATE_NAME, exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Mías", exact: true })).toHaveCount(0);

    const card = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: TEMPLATE_NAME, exact: true }) });
    await expect(card.getByRole("link", { name: "Usar plantilla" })).toHaveAttribute(
      "href",
      /^\/entrar\?next=/,
    );
  });
});
