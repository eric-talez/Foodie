import { expect, type Locator, type Page } from "@playwright/test";

export const coveredLocation = "10000000-0000-0000-0000-000000000001";
export const groupedQuery = `locationId=${coveredLocation}&mode=GROUPED`;

export async function chooseCoveredLocation(page: Page) {
  await page.goto("/");
  await page.getByLabel("Demo delivery location").selectOption(coveredLocation);
  await page.getByRole("button", { name: "Find restaurants" }).click();
  await expect(page).toHaveURL(`/restaurants?${groupedQuery}`);
}

export async function addChickenBowl(page: Page) {
  await page.getByRole("link", { name: /Orchard Bowl Kitchen/ }).click();
  await page.getByRole("button", { name: "Customize Citrus Chicken Bowl" }).click();
  const dialog = page.getByRole("dialog", { name: "Citrus Chicken Bowl" });
  await expect(dialog.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  await dialog.getByRole("checkbox", { name: /Brown rice/ }).check();
  await dialog.getByRole("button", { name: "Add to cart" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("complementary", { name: "Your cart" })).toContainText("Brown rice");
}

// Reach each control through the page's real tab order, without programmatic focus.
export async function tabTo(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  for (let count = 0; count < 40; count++) {
    if (await control.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(control).toBeFocused();
}
