import { expect, test } from "@playwright/test";
import { addChickenBowl, chooseCoveredLocation, groupedQuery } from "./journey";

test("seeded customer journey prices a customized cart and stops at preview", async ({ page }) => {
  await chooseCoveredLocation(page);
  const orchard = page.getByRole("link", { name: /Orchard Bowl Kitchen/ });
  await expect(orchard).toContainText("$6.99 delivery");
  await expect(orchard).toContainText("45–60 min");
  await addChickenBowl(page);
  await page.getByRole("link", { name: "Review cart pricing" }).click();
  await expect(page).toHaveURL(`/cart?${groupedQuery}`);
  await page.getByRole("combobox", { name: "Quantity for Citrus Chicken Bowl (Brown rice)" }).selectOption("2");
  const pricing = page.getByRole("region", { name: "Demo pricing" });
  // Two $14.50 bowls, 5% service, $6.99 grouped delivery, 9% food tax.
  for (const [label, amount] of [["Food subtotal", "$29.00"], ["Service fee", "$1.45"],
    ["Delivery fee", "$6.99"], ["Estimated tax", "$2.61"], ["Total", "$40.05"]]) {
    await expect(pricing.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("+ dd")).toHaveText(amount);
  }
  await expect(pricing).toContainText("Grouped delivery");
  await expect(pricing).toContainText("Estimated arrival: 45–60 minutes");
  await page.getByRole("button", { name: "Continue to checkout preview" }).click();
  await expect(page.getByRole("heading", { name: "Checkout preview" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Preview items" })).toContainText("Citrus Chicken Bowl × 2");
  await expect(page.getByText("Ordering is not live yet", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Demo pricing" })).toContainText("$40.05");
  await expect(page.getByRole("main").locator("form, button, input[type=submit]")).toHaveCount(0);
  await page.getByRole("link", { name: "Back to cart" }).click();
  await page.getByRole("link", { name: "Back to restaurants", exact: true }).click();
  await page.getByRole("radio", { name: "Direct delivery", exact: true }).check();
  await expect(orchard).toContainText("$11.49 delivery");
  await expect(orchard).toContainText("25–35 min");
});
