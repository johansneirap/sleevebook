import { expect, test } from "@playwright/test";

test("landing renders the hero and links to binders and the demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("landing-hero")).toBeVisible();
  await expect(page.getByRole("link", { name: "Mis binders" })).toHaveAttribute("href", "/binders");
  await expect(page.getByRole("link", { name: "Ver demo" })).toHaveAttribute("href", "/demo");
});
