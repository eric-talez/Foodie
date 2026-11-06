import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import RootLayout, { metadata } from "./layout";
import Home from "./page";

vi.mock("../lib/api", () => ({ api: { getLocations: () => new Promise(() => {}) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() => vi.stubEnv("FOODIE_BUILD_API_ORIGIN", "http://localhost:8080"));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function loadNextConfig(origin?: string) {
  vi.resetModules();
  vi.stubEnv("FOODIE_API_ORIGIN", origin);
  return (await import("../../next.config")).default;
}

test("offers location entry with Foodie's transparent fee and fair driver promise", () => {
  render(<Home />);

  expect(screen.getByRole("link", { name: "Foodie home" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/lower fees/i);
  expect(screen.getByText(/fair pay for drivers/i)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Choose your location" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
  expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  expect(screen.getByText(/ordering is not live yet/i)).toBeInTheDocument();
});

test("a DEMO response displays the badge and discloses the sample locations and menus", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ mode: "DEMO", orderingEnabled: false })));
  const markup = renderToStaticMarkup(await RootLayout({ children: <Home /> }));
  const page = new DOMParser().parseFromString(markup, "text/html");

  expect(page.querySelector("header")?.textContent).toBe("Foodie.Demo");
  expect(page.querySelector("footer p:last-child")?.textContent).toBe("Ordering is not live yet. Sample locations and menus only.");
});

test("a PILOT response removes demo wording but never enables ordering", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ mode: "PILOT", orderingEnabled: true })));
  const markup = renderToStaticMarkup(await RootLayout({ children: <Home /> }));
  const page = new DOMParser().parseFromString(markup, "text/html");

  expect(page.body.textContent).not.toMatch(/\bdemo\b/i);
  expect(metadata.description).not.toMatch(/\bdemo\b/i);
  expect(page.querySelector("footer p:last-child")?.textContent).toBe("Ordering is not live yet.");
});

test("sets the required browser security headers on all routes", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const nextConfig = await loadNextConfig();
  const rules = await nextConfig.headers?.();
  const headers = Object.fromEntries((rules?.find(({ source }) => source === "/:path*")?.headers ?? []).map(({ key, value }) => [key, value]));

  expect(headers).toMatchObject({
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  });
  expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
  expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  expect(headers["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
});

test.each([[undefined, "http://localhost:8080"], ["https://LOCALHOST:443/", "https://localhost"]])(
  "shares the build origin between the runtime descriptor and API rewrite with FOODIE_API_ORIGIN=%s", async (origin, expected) => {
    const nextConfig = await loadNextConfig(origin);
    vi.stubEnv("FOODIE_API_ORIGIN", "http://localhost:8081");
    expect(nextConfig.env?.FOODIE_BUILD_API_ORIGIN).toBe(expected);
    expect(await nextConfig.rewrites?.()).toEqual([{ source: "/api/:path*", destination: `${expected}/api/:path*` }]);
  },
);

test.each(["data:application/json,{}", "https://user:password@localhost", "https://localhost/api"])(
  "rejects an invalid configured origin before building the API rewrite: %s", async (origin) => {
    await expect(loadNextConfig(origin)).rejects.toThrow("FOODIE_API_ORIGIN must be a plain HTTP(S) origin");
  },
);
