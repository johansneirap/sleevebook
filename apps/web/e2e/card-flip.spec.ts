import { expect, test } from "@playwright/test";

test("the flip button toggles the card and aria-pressed", async ({ page }) => {
  await page.goto("/demo");

  const button = page.getByRole("button", { name: "Voltear carta" });
  const front = page.getByTestId("flip-card-front");
  const back = page.getByTestId("card-back");

  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(front).not.toHaveAttribute("aria-hidden", "true");

  await button.click();

  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(front).toHaveAttribute("aria-hidden", "true");
  await expect(back).toBeVisible();
  await expect(page.getByTestId("flip-card-back")).not.toHaveAttribute("aria-hidden", "true");

  await button.click();

  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(front).not.toHaveAttribute("aria-hidden", "true");
});

test("pressing f toggles the flip", async ({ page }) => {
  await page.goto("/demo");

  const button = page.getByRole("button", { name: "Voltear carta" });
  const front = page.getByTestId("flip-card-front");

  await page.keyboard.press("f");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(front).toHaveAttribute("aria-hidden", "true");

  await page.keyboard.press("F");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(front).not.toHaveAttribute("aria-hidden", "true");
});
