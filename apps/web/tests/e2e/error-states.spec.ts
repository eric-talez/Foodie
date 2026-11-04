import { expect, test } from "@playwright/test";
import { addChickenBowl, chooseCoveredLocation, coveredLocation, groupedQuery, tabTo } from "./journey";

test("outside coverage offers location recovery without restaurant cards", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Demo delivery location").selectOption("10000000-0000-0000-0000-000000000004");
  await page.getByRole("button", { name: "Find restaurants" }).click();
  await expect(page.getByRole("status")).toContainText("outside our delivery coverage");
  await expect(page.getByRole("list", { name: "Nearby restaurants" })).toHaveCount(0);
  await page.getByRole("link", { name: "Choose another location" }).click();
  await expect(page.getByLabel("Demo delivery location")).toBeVisible();
});

test("Back and Forward preserve location and selected delivery mode", async ({ page }) => {
  await chooseCoveredLocation(page);
  await page.getByRole("radio", { name: "Direct delivery", exact: true }).check();
  const query = `locationId=${coveredLocation}&mode=DIRECT`;
  await expect(page).toHaveURL(`/restaurants?${query}`);
  await page.getByRole("link", { name: /Orchard Bowl Kitchen/ }).click();
  await expect(page).toHaveURL(`/restaurants/orchard-bowl-kitchen?${query}`);
  await page.goBack();
  await expect(page).toHaveURL(`/restaurants?${query}`);
  await expect(page.getByRole("radio", { name: "Direct delivery", exact: true })).toBeChecked();
  await page.goForward();
  await expect(page).toHaveURL(`/restaurants/orchard-bowl-kitchen?${query}`);
  await expect(page.getByRole("heading", { name: "Orchard Bowl Kitchen" })).toBeVisible();
});

test("keyboard alone reaches location, required modifier, and cart pricing", async ({ page }) => {
  await page.goto("/");
  const location = page.getByLabel("Demo delivery location");
  await tabTo(page, location);
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  await expect(location).toHaveValue(coveredLocation);
  await tabTo(page, page.getByRole("button", { name: "Find restaurants" }));
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("link", { name: /Orchard Bowl Kitchen/ }));
  await page.keyboard.press("Enter");
  const customize = page.getByRole("button", { name: "Customize Citrus Chicken Bowl" });
  await tabTo(page, customize);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Citrus Chicken Bowl" });
  await expect(dialog.getByRole("button", { name: "Close customization" })).toBeFocused();
  await tabTo(page, dialog.getByRole("checkbox", { name: /Brown rice/ }));
  await page.keyboard.press("Space");
  await tabTo(page, dialog.getByRole("button", { name: "Add to cart" }));
  await page.keyboard.press("Enter");
  await expect(customize).toBeFocused();
  await tabTo(page, page.getByRole("link", { name: "Review cart pricing" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/cart?${groupedQuery}`);
  await tabTo(page, page.getByRole("combobox", { name: "Quantity for Citrus Chicken Bowl (Brown rice)" }));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("region", { name: "Demo pricing" })).toContainText("$40.05");
});

test("corrupted saved cart recovers and accepts a fresh item", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("foodie.cart.v1", "{broken-json"));
  await chooseCoveredLocation(page);
  await page.getByRole("link", { name: /Orchard Bowl Kitchen/ }).click();
  await expect(page.getByRole("complementary", { name: "Your cart" })).toContainText("Your cart is empty.");
  await page.getByRole("link", { name: /Back to restaurants/ }).click();
  await addChickenBowl(page);
  await page.getByRole("link", { name: "Review cart pricing" }).click();
  await expect(page.getByRole("region", { name: "Demo pricing" })).toContainText("$23.53");
});

test("a quote failure removes official totals, preserves items, and permits retry", async ({ page }) => {
  await chooseCoveredLocation(page);
  await addChickenBowl(page);
  await page.getByRole("link", { name: "Review cart pricing" }).click();
  await expect(page.getByRole("region", { name: "Demo pricing" })).toBeVisible();
  await page.route("**/api/v1/quotes", (route) => route.fulfill({
    status: 503, contentType: "application/json",
    body: JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "Pricing is temporarily unavailable.", details: [] }),
  }));
  await page.getByRole("combobox", { name: "Quantity for Citrus Chicken Bowl (Brown rice)" }).selectOption("2");
  await expect(page.getByRole("alert")).toContainText("Pricing is temporarily unavailable.");
  await expect(page.getByRole("region", { name: "Demo pricing" })).toHaveCount(0);
  await expect(page.getByText("Total", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Cart items" })).toContainText("Citrus Chicken Bowl");
  await expect(page.getByRole("combobox", { name: /Quantity for Citrus Chicken Bowl/ })).toHaveValue("2");
  await expect(page.getByRole("button", { name: "Continue to checkout preview" })).toBeDisabled();
  await page.unroute("**/api/v1/quotes");
  await page.getByRole("button", { name: "Retry pricing" }).click();
  await expect(page.getByRole("region", { name: "Demo pricing" })).toContainText("$40.05");
});
