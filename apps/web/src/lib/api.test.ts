import { afterEach, expect, test, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.unstubAllGlobals());

test("fetches the relative public location endpoint and returns its response", async () => {
  const locations = [{ id: "10000000-0000-0000-0000-000000000001", label: "Santa Clara Central", city: "Santa Clara", inCoverage: true }];
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(locations)));
  vi.stubGlobal("fetch", fetch);
  await expect(api.getLocations()).resolves.toEqual(locations);
  expect(fetch).toHaveBeenCalledWith("/api/v1/locations");
});

test("preserves structured API error code, message and details", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "INVALID_REQUEST", message: "Location request failed", details: ["Try later"] }), { status: 400 })));
  await expect(api.getLocations()).rejects.toMatchObject({ code: "INVALID_REQUEST", message: "Location request failed", details: ["Try later"] });
});

test("rejects malformed success data with a readable error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: "wrong shape" }]))));
  await expect(api.getLocations()).rejects.toThrow("Unable to load locations. Please try again later.");
});

test.each(["Bad gateway", JSON.stringify({ message: "", code: 123 }), "null"])("provides a readable fallback for an invalid error response: %s", async (body) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 502 })));
  await expect(api.getLocations()).rejects.toThrow("Unable to load locations. Please try again later.");
});

const quoteRequest = { locationId: "location", restaurantId: "restaurant", deliveryMode: "GROUPED" as const, lines: [{ lineId: "line", menuItemId: "item", quantity: 1, modifierOptionIds: ["option"] }] };
const quoteResponse = { currency: "USD", subtotalCents: 1200, serviceFeeCents: 60, deliveryFeeCents: 199, estimatedTaxCents: 108, totalCents: 1567, deliveryMode: "GROUPED", estimatedMinutesMin: 45, estimatedMinutesMax: 60, demo: true };

test("quote transport whitelists request fields and propagates cancellation", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(quoteResponse)));
  vi.stubGlobal("fetch", fetch);
  const controller = new AbortController();
  const untrustedRequest = { ...quoteRequest, totalCents: 1, lines: [{ ...quoteRequest.lines[0], unitPriceCents: 1 }] };
  await expect(api.createQuote(untrustedRequest, controller.signal)).resolves.toEqual(quoteResponse);
  expect(fetch).toHaveBeenCalledWith("/api/v1/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify(quoteRequest) });
});

test.each([
  null, { ...quoteResponse, currency: "EUR" }, { ...quoteResponse, demo: false },
  { ...quoteResponse, totalCents: -1 }, { ...quoteResponse, subtotalCents: 1.5 },
  { ...quoteResponse, totalCents: Number.MAX_SAFE_INTEGER + 1 }, { ...quoteResponse, serviceFeeCents: undefined },
  { ...quoteResponse, deliveryMode: "DIRECT" }, { ...quoteResponse, estimatedMinutesMax: 40 },
])("rejects malformed or mismatched quote data: %j", async (body) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
  await expect(api.createQuote(quoteRequest)).rejects.toThrow(/unable to load pricing/i);
});

test("preserves unavailable line details from the quote endpoint", async () => {
  const error = { code: "ITEM_UNAVAILABLE", message: "An item is unavailable", details: [{ lineId: "line", menuItemId: "item", reason: "Inactive" }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(error), { status: 409 })));
  await expect(api.createQuote(quoteRequest)).rejects.toMatchObject(error);
});
