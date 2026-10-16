import { expect, test } from "@playwright/test";
import { binder, createDb } from "@sleevebook/db";
import { like } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

const RUN_TAG = `crud-${Date.now()}`;
const ORIGINAL_NAME = `E2E CRUD ${RUN_TAG}`;
const RENAMED_NAME = `E2E CRUD Renamed ${RUN_TAG}`;

test.afterAll(async () => {
  await db.delete(binder).where(like(binder.name, `%${RUN_TAG}%`));
  await db.$client.end();
});

test("create, rename, duplicate, archive and delete a binder", async ({ page }) => {
  await page.goto("/binders/new?rows=4&cols=3");
  await page.getByLabel("Nombre").fill(ORIGINAL_NAME);
  await page.getByLabel("Hojas").fill("2");
  await page.getByRole("button", { name: "Crear" }).click();

  await expect(page).toHaveURL(/\/binders\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: ORIGINAL_NAME })).toBeVisible();
  // A freshly created binder lands on its closed cover (no ?spread param).
  await expect(page.getByTestId("closed-binder")).toBeVisible();
  await page.getByRole("button", { name: "Abrir binder" }).click();
  await expect(page.getByText("Spread 1 / 3")).toBeVisible();

  await page.goto("/binders");
  const rowFor = (name: string) =>
    page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });

  const originalRow = rowFor(ORIGINAL_NAME);
  await expect(originalRow).toContainText("4×3");
  await expect(originalRow).toContainText("2 hojas");

  await originalRow.getByRole("textbox").fill(RENAMED_NAME);
  await originalRow.getByRole("button", { name: "Renombrar" }).click();
  await expect(rowFor(RENAMED_NAME)).toBeVisible();

  const renamedRow = rowFor(RENAMED_NAME);
  await renamedRow.getByRole("button", { name: "Duplicar" }).click();
  const copyRow = rowFor(`${RENAMED_NAME} (copia)`);
  await expect(copyRow).toBeVisible();

  await renamedRow.getByRole("button", { name: "Archivar" }).click();
  await expect(rowFor(RENAMED_NAME)).toContainText("archived");
  await expect(rowFor(RENAMED_NAME).getByRole("button", { name: "Desarchivar" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await copyRow.getByRole("button", { name: "Eliminar" }).click();
  await expect(rowFor(`${RENAMED_NAME} (copia)`)).toHaveCount(0);

  const [remaining] = await db
    .select()
    .from(binder)
    .where(like(binder.name, `%${RUN_TAG}%`));
  expect(remaining).toBeDefined();
  expect(remaining?.status).toBe("archived");
});
