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
