import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { CartProvider, useCart } from "../features/cart/CartProvider";
import { ItemCustomizer } from "./ItemCustomizer";
import type { MenuItem } from "../lib/types";

const item: MenuItem = {
  id: "bowl", name: "Harvest bowl", description: "Seasonal vegetables", priceCents: 1200, imageReference: null,
  modifierGroups: [
    { id: "protein", name: "Protein", minSelections: 1, maxSelections: 1, options: [
      { id: "tofu", label: "Tofu", priceDeltaCents: 0 }, { id: "chicken", label: "Chicken", priceDeltaCents: 200 },
    ] },
    { id: "extras", name: "Extras", minSelections: 0, maxSelections: 1, options: [
      { id: "avocado", label: "Avocado", priceDeltaCents: 150 }, { id: "seeds", label: "Seeds", priceDeltaCents: 50 },
    ] },
  ],
};
function Probe() {
  const { state } = useCart();
  return <div aria-label="Cart data">{JSON.stringify(state)}</div>;
}
function mount(value = item, restaurantId = "green-table") {
  return render(<CartProvider><ItemCustomizer item={value} restaurantId={restaurantId} /><Probe /></CartProvider>);
}
function open() { fireEvent.click(screen.getByRole("button", { name: "Customize Harvest bowl" })); }
// jsdom does not implement native dialog methods; focus behavior remains real.
beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } },
  });
});
afterEach(() => { cleanup(); localStorage.clear(); });

test("requires the minimum, disables unchecked options at maximum, and estimates selected deltas", () => {
  mount(); open();
  const dialog = screen.getByRole("dialog", { name: "Harvest bowl" });
  const add = within(dialog).getByRole("button", { name: /add to cart/i });
  expect(add).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /Chicken/ }));
  expect(add).toBeEnabled();
  expect(screen.getByRole("checkbox", { name: /Tofu/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /Avocado/ }));
  expect(screen.getByRole("checkbox", { name: /Seeds/ })).toBeDisabled();
  expect(screen.getByText("Estimated item total: $15.50")).toBeVisible();
  fireEvent.click(screen.getByRole("checkbox", { name: /Chicken/ }));
  expect(add).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: /Tofu/ })).toBeEnabled();
});

test("allows omitted optional groups and announces a successful add with IDs and display hints", () => {
  mount(); open();
  fireEvent.click(screen.getByRole("checkbox", { name: /Tofu/ }));
  fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Harvest bowl added to cart");
  expect(JSON.parse(screen.getByLabelText("Cart data").textContent!).lines[0]).toMatchObject({
    menuItemId: "bowl", restaurantId: "green-table", quantity: 1, modifierOptionIds: ["tofu"],
    unitPriceCents: 1200, modifierTotalCents: 0,
  });
  expect(screen.getByRole("button", { name: "Customize Harvest bowl" })).toHaveFocus();
});

test("Escape closes the dialog and restores focus to its trigger", () => {
  mount(); open();
  expect(screen.getByRole("button", { name: "Close customization" })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Customize Harvest bowl" })).toHaveFocus();
});

test("traps Tab and Shift+Tab at dialog boundaries", () => {
  mount(); open();
  fireEvent.click(screen.getByRole("checkbox", { name: /Tofu/ }));
  const close = screen.getByRole("button", { name: "Close customization" });
  const add = screen.getByRole("button", { name: /add to cart/i });
  add.focus();
  fireEvent.keyDown(add, { key: "Tab" });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(add).toHaveFocus();
});

test("enforces minimums above one and resets selections when reopened", () => {
  mount({ ...item, modifierGroups: [{ ...item.modifierGroups[0], minSelections: 2, maxSelections: 2 }] }); open();
  fireEvent.click(screen.getByRole("checkbox", { name: /Tofu/ }));
  expect(screen.getByRole("button", { name: /add to cart/i })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /Chicken/ }));
  expect(screen.getByRole("button", { name: /add to cart/i })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Close customization" })); open();
  expect(screen.getByRole("checkbox", { name: /Tofu/ })).not.toBeChecked();
});

test("refuses a second restaurant with feedback and preserves the original cart", () => {
  render(<CartProvider><ItemCustomizer item={item} restaurantId="first" /><ItemCustomizer item={{ ...item, name: "Other bowl" }} restaurantId="second" /><Probe /></CartProvider>);
  open(); fireEvent.click(screen.getByRole("checkbox", { name: /Tofu/ }));
  fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
  const before = screen.getByLabelText("Cart data").textContent;
  fireEvent.click(screen.getByRole("button", { name: "Customize Other bowl" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Tofu/ }));
  fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
  expect(screen.getByRole("alert")).toHaveTextContent(/one restaurant/i);
  expect(screen.getByLabelText("Cart data").textContent).toBe(before);
});
