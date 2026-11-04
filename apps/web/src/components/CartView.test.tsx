import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import CartPage from "../app/cart/page";
import { CartProvider } from "../features/cart/CartProvider";
import { CART_STORAGE_KEY } from "../features/cart/cartStorage";
import { CartView } from "./CartView";
import { MenuView } from "./MenuView";

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
const locationId = "10000000-0000-0000-0000-000000000001";
const line = { lineId: '["bowl",["tofu"]]', restaurantId: "restaurant", menuItemId: "bowl", itemName: "Harvest bowl", unitPriceCents: 99999, quantity: 1, modifierOptionIds: ["tofu"], modifierLabels: ["Tofu"], modifierTotalCents: 999 };
const quote = { currency: "USD", subtotalCents: 1200, serviceFeeCents: 60, deliveryFeeCents: 199, estimatedTaxCents: 108, totalCents: 1567, deliveryMode: "GROUPED", estimatedMinutesMin: 45, estimatedMinutesMax: 60, demo: true };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function mount(mode: "GROUPED" | "DIRECT" = "GROUPED") { return render(<CartProvider><CartView locationId={locationId} mode={mode} /></CartProvider>); }
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, state: { restaurantId: "restaurant", lines: [line] } }));
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response(quote))));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

test("sends only pricing identifiers and discloses all server totals and grouped ETA", async () => {
  mount();
  expect(await screen.findByRole("region", { name: "Demo pricing" })).toBeVisible();
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ locationId, restaurantId: "restaurant", deliveryMode: "GROUPED", lines: [{ lineId: line.lineId, menuItemId: "bowl", quantity: 1, modifierOptionIds: ["tofu"] }] });
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/v1/quotes");
  for (const [label, amount] of [["Food subtotal", "$12.00"], ["Service fee", "$0.60"], ["Delivery fee", "$1.99"], ["Estimated tax", "$1.08"], ["Total", "$15.67"]]) {
    expect(screen.getByText(label).nextElementSibling).toHaveTextContent(amount);
  }
  expect(screen.getByText("Grouped delivery")).toBeVisible();
  expect(screen.getByText("Estimated arrival: 45–60 minutes")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Continue to checkout preview" }));
  expect(push).toHaveBeenCalledWith(`/checkout-preview?locationId=${locationId}&mode=GROUPED`);
});

test("clears official totals synchronously on quantity changes and ignores superseded requests", async () => {
  mount(); await screen.findByText("$15.67");
  let oldFinish!: (value: Response) => void;
  let newFinish!: (value: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { oldFinish = resolve; })).mockImplementationOnce(() => new Promise((resolve) => { newFinish = resolve; }));
  const quantity = screen.getByRole("combobox", { name: "Quantity for Harvest bowl (Tofu)" });
  fireEvent.change(quantity, { target: { value: "2" } });
  expect(screen.queryByRole("region", { name: "Demo pricing" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue to checkout preview" })).toBeDisabled();
  fireEvent.change(quantity, { target: { value: "3" } });
  expect((vi.mocked(fetch).mock.calls[1][1]!.signal as AbortSignal).aborted).toBe(true);
  await act(async () => { newFinish(response({ ...quote, totalCents: 3900 })); });
  expect(await screen.findByText("$39.00")).toBeVisible();
  await act(async () => { oldFinish(response(quote)); });
  expect(screen.queryByText("$15.67")).not.toBeInTheDocument();
  expect(JSON.parse(vi.mocked(fetch).mock.calls[2][1]!.body as string).lines[0].quantity).toBe(3);
});

test.each(["network", "api", "malformed"])("keeps lines but clears every official total after %s failure and allows retry", async (failure) => {
  mount(); await screen.findByText("$15.67");
  if (failure === "network") vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
  else vi.mocked(fetch).mockResolvedValueOnce(response(failure === "api" ? { code: "DELIVERY_UNAVAILABLE", message: "Delivery is unavailable.", details: [] } : { ...quote, totalCents: -1 }, failure === "api" ? 409 : 200));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Harvest bowl" })).toBeVisible();
  expect(screen.getByText(/Saved unit estimate/)).toHaveTextContent("$1,009.98");
  expect(screen.queryByRole("region", { name: "Demo pricing" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue to checkout preview" })).toBeDisabled();
  expect(push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry pricing" }));
  expect(await screen.findByText("$15.67")).toBeVisible();
});

test("identifies unavailable variants without dropping any lines and requires removal or reconfiguration", async () => {
  vi.mocked(fetch).mockResolvedValue(response({ code: "ITEM_UNAVAILABLE", message: "One or more cart items are unavailable", details: [{ lineId: line.lineId, menuItemId: "bowl", reason: "Inactive" }] }, 409));
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent(/Harvest bowl \(Tofu\).*remove or reconfigure/i);
  expect(screen.getByRole("combobox")).toHaveValue("1");
  expect(screen.getByRole("button", { name: "Continue to checkout preview" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Retry pricing" })).not.toBeInTheDocument();
});

test("removing a line requotes the retained lines; removing the last line disables checkout", async () => {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, state: { restaurantId: "restaurant", lines: [line, { ...line, lineId: '["side",[]]', menuItemId: "side", itemName: "Side salad", modifierOptionIds: [], modifierLabels: [] }] } }));
  mount(); await screen.findByText("$15.67");
  fireEvent.click(screen.getByRole("button", { name: "Remove Harvest bowl (Tofu)" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string).lines).toEqual([{ lineId: '["side",[]]', menuItemId: "side", quantity: 1, modifierOptionIds: [] }]);
  fireEvent.click(screen.getByRole("button", { name: "Remove Side salad" }));
  expect(screen.getByText("Your cart is empty.")).toBeVisible();
  expect(screen.queryByRole("region", { name: "Demo pricing" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue to checkout preview" })).toBeDisabled();
});

test("location and mode changes hide old prices and require a matching direct quote", async () => {
  const view = mount(); await screen.findByText("$15.67");
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const nextLocation = "10000000-0000-0000-0000-000000000002";
  view.rerender(<CartProvider><CartView locationId={nextLocation} mode="DIRECT" /></CartProvider>);
  expect(screen.queryByText("$15.67")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue to checkout preview" })).toBeDisabled();
  await act(async () => { finish(response({ ...quote, deliveryMode: "DIRECT", estimatedMinutesMin: 25, estimatedMinutesMax: 35 })); });
  expect(await screen.findByText("Direct delivery")).toBeVisible();
  expect(screen.getByText("Estimated arrival: 25–35 minutes")).toBeVisible();
});

test.each([{}, { locationId: "bad" }, { locationId, mode: "FAST" }, { locationId: [locationId] }, { locationId, mode: ["DIRECT"] }])("invalid cart context keeps cart recovery available without fetching: %j", async (query) => {
  render(<CartProvider>{await CartPage({ searchParams: Promise.resolve(query) })}</CartProvider>);
  expect(screen.getByRole("link", { name: "Choose a location" })).toHaveAttribute("href", "/");
  expect(fetch).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).state.lines).toHaveLength(1);
});

test("menu handoff carries location and delivery mode into the cart URL", async () => {
  vi.mocked(fetch).mockResolvedValue(response({ id: "restaurant", slug: "green-table", name: "Green Table", description: "Food", city: "Santa Clara", cuisine: "California", categories: [] }));
  render(<CartProvider><MenuView slug="green-table" locationId={locationId} mode="DIRECT" /></CartProvider>);
  expect(await screen.findByRole("link", { name: "Review cart pricing" })).toHaveAttribute("href", `/cart?locationId=${locationId}&mode=DIRECT`);
});
