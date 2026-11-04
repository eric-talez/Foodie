import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import RestaurantPage from "../app/restaurants/[slug]/page";
import { CartProvider } from "../features/cart/CartProvider";
import { CART_STORAGE_KEY } from "../features/cart/cartStorage";
import { MenuView } from "./MenuView";

const locationId = "10000000-0000-0000-0000-000000000001";
const menu = {
  id: "green-table", slug: "green-table", name: "Green Table", description: "Seasonal food", city: "Santa Clara", cuisine: "California",
  categories: [{ id: "bowls", name: "Bowls", items: [{ id: "bowl", name: "Harvest bowl", description: "Seasonal vegetables", priceCents: 1200, imageReference: null, modifierGroups: [] }] }],
};
const line = {
  lineId: '["bowl",[]]', restaurantId: "green-table", menuItemId: "bowl", itemName: "Harvest bowl",
  unitPriceCents: 1200, quantity: 2, modifierOptionIds: [], modifierLabels: [], modifierTotalCents: 0,
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(menu))); });
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
function mount(slug = "green-table") {
  return render(<CartProvider><MenuView slug={slug} locationId={locationId} mode="DIRECT" /></CartProvider>);
}

test("loads restaurant detail and preserves delivery context", async () => {
  render(<CartProvider>{await RestaurantPage({ params: Promise.resolve({ slug: "green-table" }), searchParams: Promise.resolve({ locationId, mode: "DIRECT" }) })}</CartProvider>);
  expect(await screen.findByRole("heading", { name: "Green Table" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Bowls" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Customize Harvest bowl" })).toBeEnabled();
  expect(screen.getByRole("link", { name: /back to restaurants/i })).toHaveAttribute("href", `/restaurants?locationId=${locationId}&mode=DIRECT`);
  expect(fetch).toHaveBeenCalledWith("/api/v1/restaurants/green-table");
});

test("keeps categories and items in API display order", async () => {
  const base = menu.categories[0].items[0];
  vi.mocked(fetch).mockResolvedValue(response({ ...menu, categories: [
    { id: "z", name: "Seasonal specials", items: [{ ...base, id: "z", name: "Zucchini bowl" }, { ...base, id: "a", name: "Avocado bowl" }] },
    { id: "a", name: "Appetizers", items: [{ ...base, id: "side", name: "Side salad" }] },
  ] }));
  mount();
  await screen.findByRole("heading", { name: "Green Table" });
  expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Seasonal specials", "Appetizers", "Your cart"]);
  expect(screen.getAllByRole("button", { name: /customize/i }).map((button) => button.getAttribute("aria-label"))).toEqual([
    "Customize Zucchini bowl", "Customize Avocado bowl", "Customize Side salad",
  ]);
});

test("announces loading and retries readable detail errors", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(response({ code: "NOT_FOUND", message: "This restaurant is unavailable.", details: [] }, 404));
  mount();
  expect(screen.getByText(/loading menu/i)).toHaveAttribute("role", "status");
  expect(await screen.findByRole("alert")).toHaveTextContent("This restaurant is unavailable.");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("heading", { name: "Green Table" })).toBeVisible();
});

test.each([
  null, { ...menu, slug: "different" }, { ...menu, categories: null },
  { ...menu, categories: [{ ...menu.categories[0], items: [{ ...menu.categories[0].items[0], priceCents: -1 }] }] },
  { ...menu, categories: [{ ...menu.categories[0], items: [{ ...menu.categories[0].items[0], modifierGroups: [{ id: "g", name: "Bad", minSelections: 2, maxSelections: 1, options: [] }] }] }] },
])("does not expose malformed detail as customizable items: %j", async (body) => {
  vi.mocked(fetch).mockResolvedValue(response(body)); mount();
  expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load menu/i);
  expect(screen.queryByRole("button", { name: /customize/i })).not.toBeInTheDocument();
});

test.each([2, 1])("requires enough active options for a group minimum of %s while allowing a larger maximum", async (minimum) => {
  vi.mocked(fetch).mockResolvedValue(response({ ...menu, categories: [{ ...menu.categories[0], items: [{
    ...menu.categories[0].items[0], modifierGroups: [{ id: "protein", name: "Protein", minSelections: minimum, maxSelections: 2,
      options: [{ id: "tofu", label: "Tofu", priceDeltaCents: 0 }] }],
  }] }] }));
  mount();
  if (minimum === 2) {
    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load menu/i);
    expect(screen.queryByRole("button", { name: /customize/i })).not.toBeInTheDocument();
  } else {
    expect(await screen.findByRole("button", { name: "Customize Harvest bowl" })).toBeEnabled();
  }
});

test("ignores stale detail responses on navigation", async () => {
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValue(response({ ...menu, slug: "willow", name: "Willow" }));
  const view = mount();
  view.rerender(<CartProvider><MenuView slug="willow" locationId={locationId} mode="DIRECT" /></CartProvider>);
  await screen.findByRole("heading", { name: "Willow" });
  await act(async () => { finish(response(menu)); });
  expect(screen.queryByRole("heading", { name: "Green Table" })).not.toBeInTheDocument();
});

test("hydrates stored lines before saving and persists quantity and remove actions", async () => {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, state: { restaurantId: "green-table", lines: [line] } }));
  const first = mount();
  const quantity = await screen.findByRole("combobox", { name: "Quantity for Harvest bowl" });
  expect(quantity).toHaveValue("2");
  expect(screen.getByText("Estimated food subtotal: $24.00")).toBeVisible();
  fireEvent.change(quantity, { target: { value: "20" } });
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).state.lines[0].quantity).toBe(20);
  first.unmount(); mount();
  expect(await screen.findByRole("combobox", { name: "Quantity for Harvest bowl" })).toHaveValue("20");
  fireEvent.click(screen.getByRole("button", { name: "Remove Harvest bowl" }));
  expect(screen.getByText("Your cart is empty.")).toBeVisible();
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).state).toEqual({ restaurantId: null, lines: [] });
});

test("clears all saved lines with the explicit clear action", async () => {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, state: { restaurantId: "green-table", lines: [line] } }));
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Clear cart" }));
  expect(screen.getByText("Your cart is empty.")).toBeVisible();
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).state).toEqual({ restaurantId: null, lines: [] });
});

test("labels quantity and remove controls with their customization to distinguish variants", async () => {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, state: { restaurantId: "green-table", lines: [
    { ...line, lineId: '["bowl",["tofu"]]', modifierOptionIds: ["tofu"], modifierLabels: ["Tofu"] },
    { ...line, lineId: '["bowl",["chicken"]]', modifierOptionIds: ["chicken"], modifierLabels: ["Chicken"] },
  ] } }));
  mount();
  expect(await screen.findByRole("combobox", { name: "Quantity for Harvest bowl (Tofu)" })).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Quantity for Harvest bowl (Chicken)" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Remove Harvest bowl (Tofu)" }));
  expect(screen.queryByRole("combobox", { name: "Quantity for Harvest bowl (Tofu)" })).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Quantity for Harvest bowl (Chicken)" })).toBeVisible();
});

test("malformed saved data renders an empty cart and is replaced with a safe version", async () => {
  localStorage.setItem(CART_STORAGE_KEY, "broken"); mount();
  expect(await screen.findByText("Your cart is empty.")).toBeVisible();
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).state.lines).toEqual([]);
});

test.each([{}, { locationId: "bad" }, { locationId, mode: "FAST" }, { locationId: [locationId] }])("invalid detail route context requests a location: %j", async (query) => {
  render(await RestaurantPage({ params: Promise.resolve({ slug: "green-table" }), searchParams: Promise.resolve(query) }));
  expect(screen.getByRole("link", { name: "Choose a location" })).toHaveAttribute("href", "/");
  expect(fetch).not.toHaveBeenCalled();
});
