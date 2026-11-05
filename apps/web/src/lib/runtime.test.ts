import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getRuntime } from "./runtime";

beforeEach(() => vi.stubEnv("FOODIE_BUILD_API_ORIGIN", "http://localhost:8080"));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test.each([
  { mode: "DEMO", orderingEnabled: false },
  { mode: "PILOT", orderingEnabled: true },
])("loads valid $mode runtime flags from the build origin even when the startup origin changes", async (body) => {
  vi.stubEnv("FOODIE_API_ORIGIN", "http://localhost:8081");
  const fetch = vi.fn().mockResolvedValue(Response.json(body));
  vi.stubGlobal("fetch", fetch);

  await expect(getRuntime()).resolves.toEqual(body);
  expect(fetch).toHaveBeenCalledWith("http://localhost:8080/api/v1/runtime", expect.objectContaining({ cache: "no-store" }));
});

test.each([
  undefined, "", "data:application/json,{}", "file:///runtime.json", "ftp://localhost", "http:localhost",
  "http://user:password@localhost", "http://@localhost", "http://localhost/api", "http://localhost/.",
  "http://localhost?", "http://localhost/?debug=1", "http://localhost#", "http://localhost/#mode",
])("fails closed without fetching for an invalid build origin: %s", async (origin) => {
  vi.stubEnv("FOODIE_BUILD_API_ORIGIN", origin);
  const fetch = vi.fn().mockResolvedValue(Response.json({ mode: "PILOT", orderingEnabled: true }));
  vi.stubGlobal("fetch", fetch);

  await expect(getRuntime()).resolves.toEqual({ mode: "DEMO", orderingEnabled: false });
  expect(fetch).not.toHaveBeenCalled();
});

test("fails closed rather than accepting a descriptor from a redirect target", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (_url, init) => {
    if (init?.redirect === "error") throw new TypeError("unexpected redirect");
    return Response.json({ mode: "PILOT", orderingEnabled: true });
  });
  vi.stubGlobal("fetch", fetch);

  await expect(getRuntime()).resolves.toEqual({ mode: "DEMO", orderingEnabled: false });
  expect(fetch).toHaveBeenCalledOnce();
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
