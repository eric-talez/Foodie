import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import PreviewPage from "../app/checkout-preview/page";
import { CartProvider, useCart } from "../features/cart/CartProvider";
import { CART_STORAGE_KEY } from "../features/cart/cartStorage";
import { RuntimeModeContext } from "../lib/RuntimeModeContext";
import { CartView } from "./CartView";
import { CheckoutPreview } from "./CheckoutPreview";

const { push, replace, redirect } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), redirect }));
const locationId = "10000000-0000-0000-0000-000000000001";
const line = { lineId: '["bowl",[]]', restaurantId: "restaurant", menuItemId: "bowl", itemName: "Harvest bowl", unitPriceCents: 1200, quantity: 1, modifierOptionIds: [], modifierLabels: [], modifierTotalCents: 0 };
const quote = { currency: "USD", subtotalCents: 1200, serviceFeeCents: 60, deliveryFeeCents: 499, estimatedTaxCents: 108, totalCents: 1867, deliveryMode: "DIRECT", estimatedMinutesMin: 25, estimatedMinutesMax: 35, demo: true };
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, state: { restaurantId: "restaurant", lines: [line] } }));
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(quote)))));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
function ChangeCart() { const { dispatch } = useCart(); return <button onClick={() => dispatch({ type: "SET_QUANTITY", lineId: line.lineId, quantity: 2 })}>Change cart</button>; }

test.each([["DEMO", "Demo pricing"], ["PILOT", "Estimated pricing"]] as const)("%s repeats pricing and disclosures without submission", async (runtimeMode, pricingLabel) => {
  const view = render(<RuntimeModeContext.Provider value={runtimeMode}><CartProvider><CartView locationId={locationId} mode="DIRECT" /></CartProvider></RuntimeModeContext.Provider>);
  await screen.findByText("$18.67");
  expect(screen.getByRole("heading", { name: pricingLabel })).toBeVisible();
  view.rerender(<RuntimeModeContext.Provider value={runtimeMode}><CartProvider><CheckoutPreview locationId={locationId} mode="DIRECT" /><ChangeCart /></CartProvider></RuntimeModeContext.Provider>);
  expect(screen.getByRole("heading", { name: "Checkout preview" })).toBeVisible();
  expect(screen.getByRole("heading", { name: pricingLabel })).toBeVisible();
  if (runtimeMode === "PILOT") expect(view.container).not.toHaveTextContent(/\bdemo\b/i);
  expect(screen.getByText("Ordering is not live yet")).toBeVisible();
  for (const [label, amount] of [["Food subtotal", "$12.00"], ["Service fee", "$0.60"], ["Delivery fee", "$4.99"], ["Estimated tax", "$1.08"], ["Total", "$18.67"]]) expect(screen.getByText(label).nextElementSibling).toHaveTextContent(amount);
  expect(screen.getByText("Direct delivery")).toBeVisible();
  expect(screen.getByText("Estimated arrival: 25–35 minutes")).toBeVisible();
  expect(screen.getByText(/Harvest bowl × 1/)).toBeVisible();
  expect(screen.queryByRole("button", { name: /order|pay|submit/i })).not.toBeInTheDocument();
  expect(document.querySelector("form")).toBeNull();
  expect(screen.getByRole("link", { name: "Back to cart" })).toHaveAttribute("href", `/cart?locationId=${locationId}&mode=DIRECT`);
  fireEvent.click(screen.getByRole("button", { name: "Change cart" }));
  expect(screen.queryByText("$18.67")).not.toBeInTheDocument();
  await waitFor(() => expect(replace).toHaveBeenCalledWith(`/cart?locationId=${locationId}&mode=DIRECT`));
});

test("a refreshed preview with saved cart but no in-memory quote returns to cart", async () => {
  render(<CartProvider><CheckoutPreview locationId={locationId} mode="DIRECT" /></CartProvider>);
  await waitFor(() => expect(replace).toHaveBeenCalledWith(`/cart?locationId=${locationId}&mode=DIRECT`));
  expect(screen.queryByRole("region", { name: "Demo pricing" })).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test.each(["mode", "location"])("rejects a quote from a different %s", async (change) => {
  const view = render(<CartProvider><CartView locationId={locationId} mode="DIRECT" /></CartProvider>);
  await screen.findByText("$18.67");
  const nextLocation = change === "location" ? "10000000-0000-0000-0000-000000000002" : locationId;
  const mode = change === "mode" ? "GROUPED" : "DIRECT";
  view.rerender(<CartProvider><CheckoutPreview locationId={nextLocation} mode={mode} /></CartProvider>);
  await waitFor(() => expect(replace).toHaveBeenCalledWith(`/cart?locationId=${nextLocation}&mode=${mode}`));
  expect(screen.queryByText("$18.67")).not.toBeInTheDocument();
});

test.each([{}, { locationId: "bad" }, { locationId, mode: "FAST" }, { locationId, mode: ["DIRECT"] }])("invalid preview route redirects to cart: %j", async (query) => {
  await expect(PreviewPage({ searchParams: Promise.resolve(query) })).rejects.toThrow("redirect");
  expect(redirect).toHaveBeenCalledWith("/cart");
});
