import { expect, test } from "@playwright/test";
import { createEmptyLayout } from "@sleevebook/binder-core";
import { binder, binderVersion, createDb, shareLink, user } from "@sleevebook/db";
import { eq } from "drizzle-orm";
import { createTestUser } from "./auth-helpers";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

const OWNER_ID = "f4d-owner";
const OWNER_EMAIL = "f4d-owner@sleevebook.local";
const OWNER_HANDLE = "f4d-owner";

// Only the public one may appear in /galeria. The unlisted and draft binders
// must stay out even though they share the owner and the "F4D" prefix.
const FIXTURES = [
  {
    key: "public",
    name: "F4D Pública",
    slug: "f4d-public-slug",
    status: "published",
    visibility: "public",
  },
  {
    key: "unlisted",
    name: "F4D Oculta",
    slug: "f4d-unlisted-slug",
    status: "published",
    visibility: "unlisted",
  },
  {
    key: "draft",
    name: "F4D Borrador",
    slug: "f4d-draft-slug",
    status: "draft",
    visibility: "public",
  },
] as const;

const ids: Record<string, string> = {};

function fixtureId(key: string): string {
  const id = ids[key];
  if (!id) {
    throw new Error(`fixture ${key} was not seeded`);
  }
  return id;
}

async function setFeaturedAt(binderId: string, value: Date | null): Promise<void> {
  await db.update(binder).set({ featuredAt: value }).where(eq(binder.id, binderId));
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await createTestUser(db, {
    id: OWNER_ID,
    email: OWNER_EMAIL,
    handle: OWNER_HANDLE,
    name: "F4D Owner",
  });
  for (const fixture of FIXTURES) {
    const [row] = await db
      .insert(binder)
      .values({
        userId: OWNER_ID,
        name: fixture.name,
        formatRows: 3,
        formatCols: 3,
        sheets: 20,
        status: fixture.status,
      })
      .returning({ id: binder.id });
    const binderId = (row as { id: string }).id;
    ids[fixture.key] = binderId;
    await db
      .insert(binderVersion)
      .values({ binderId, versionNumber: 1, layout: createEmptyLayout({ rows: 3, cols: 3 }, 20) });
    await db
      .insert(shareLink)
      .values({ binderId, slug: fixture.slug, visibility: fixture.visibility });
  }
});

test.afterAll(async () => {
  // Deleting the user cascades to its binders, versions and share links.
  await db.delete(user).where(eq(user.id, OWNER_ID));
  await db.$client.end();
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the gallery lists only the public binder and search filters by name", async ({ page }) => {
    await page.goto("/galeria?q=F4D");
    await expect(page.getByRole("heading", { level: 1, name: "Galería" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Buscar binders por nombre" })).toHaveValue(
      "F4D",
    );

    const card = page.getByRole("link", { name: /F4D Pública/ });
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("href", `/s/${FIXTURES[0].slug}`);
    await expect(page.getByText("F4D Oculta")).toHaveCount(0);
    await expect(page.getByText("F4D Borrador")).toHaveCount(0);

    await page.goto("/galeria?q=F4D%20Oculta");
    await expect(
      page.getByText("No hay binders públicos que coincidan con «F4D Oculta»."),
    ).toBeVisible();
    await page.goto("/galeria?q=F4D%20Borrador");
    await expect(
      page.getByText("No hay binders públicos que coincidan con «F4D Borrador»."),
    ).toBeVisible();
  });

  test("sort links keep the search and mark the current order", async ({ page }) => {
    await page.goto("/galeria?q=F4D");
    await expect(page.getByRole("link", { name: "Recientes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.getByRole("link", { name: "Populares" }).click();
    await expect(page).toHaveURL(/\/galeria\?q=F4D&sort=populares$/);
    await expect(page.getByRole("link", { name: "Populares" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("link", { name: /F4D Pública/ })).toHaveCount(1);
  });

  test("the landing links to the gallery", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("landing-hero")).toBeVisible();
    await expect(page.getByRole("link", { name: "Explorar la galería" })).toHaveAttribute(
      "href",
      "/galeria",
    );
  });

  test("a featured binder shows in the Destacados band and on the landing strip", async ({
    page,
  }) => {
    try {
      await setFeaturedAt(fixtureId("public"), new Date());

      await page.goto("/galeria?q=F4D");
      const band = page.getByRole("region", { name: "Destacados" });
      await expect(band).toBeVisible();
      await expect(band.getByRole("link", { name: /F4D Pública/ })).toHaveAttribute(
        "href",
        `/s/${FIXTURES[0].slug}`,
      );
      // Featured binders are left out of the regular grid.
      await expect(page.getByRole("link", { name: /F4D Pública/ })).toHaveCount(1);

      await page.goto("/");
      const strip = page.getByTestId("landing-featured");
      await expect(strip).toBeVisible();
      await expect(strip.getByRole("link", { name: /F4D Pública/ })).toHaveAttribute(
        "href",
        `/s/${FIXTURES[0].slug}`,
      );
    } finally {
      await setFeaturedAt(fixtureId("public"), null);
    }
  });
});

test.describe("signed in as the dev user (not an admin)", () => {
  test("the public binder is listed but the featuring control is not shown", async ({ page }) => {
    await page.goto("/galeria?q=F4D");
    await expect(page.getByRole("link", { name: /F4D Pública/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Destacar", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Quitar destacado", exact: true })).toHaveCount(
      0,
    );
  });
});
