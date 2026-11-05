import { afterEach, expect, test, vi } from "vitest";
import { getRuntime } from "./runtime";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test.each([
  { mode: "DEMO", orderingEnabled: false },
  { mode: "PILOT", orderingEnabled: true },
])("loads valid $mode runtime flags from the configured API without caching", async (body) => {
  vi.stubEnv("FOODIE_API_ORIGIN", "http://localhost:8081");
  const fetch = vi.fn().mockResolvedValue(Response.json(body));
  vi.stubGlobal("fetch", fetch);

  await expect(getRuntime()).resolves.toEqual(body);
  expect(fetch).toHaveBeenCalledWith("http://localhost:8081/api/v1/runtime", expect.objectContaining({ cache: "no-store" }));
});

test.for([
  null, [], "PILOT", { mode: "UNKNOWN", orderingEnabled: true }, { mode: "PILOT" },
  { mode: "PILOT", orderingEnabled: "false" }, { mode: "PILOT", orderingEnabled: true, unexpected: true },
])("fails closed on an invalid runtime payload: %j", async (body) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
  await expect(getRuntime()).resolves.toEqual({ mode: "DEMO", orderingEnabled: false });
});

test("fails closed on invalid runtime JSON", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad gateway")));
  await expect(getRuntime()).resolves.toEqual({ mode: "DEMO", orderingEnabled: false });
});

test("fails closed on a failed HTTP status even with a valid runtime payload", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ mode: "PILOT", orderingEnabled: true }, { status: 503 })));
  await expect(getRuntime()).resolves.toEqual({ mode: "DEMO", orderingEnabled: false });
});

test("fails closed when the runtime endpoint is unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
  await expect(getRuntime()).resolves.toEqual({ mode: "DEMO", orderingEnabled: false });
});
