import { expect, test } from "@playwright/test";

test("renders a 3x3 face with 9 pockets", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByTestId("pocket")).toHaveCount(9);
});
