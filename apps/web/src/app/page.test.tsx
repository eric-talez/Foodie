import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import nextConfig from "../../next.config";
import RootLayout, { metadata } from "./layout";
import Home from "./page";

vi.mock("../lib/api", () => ({ api: { getLocations: () => new Promise(() => {}) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

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

test("displays the Demo badge for a DEMO response", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ mode: "DEMO", orderingEnabled: false })));
  const markup = renderToStaticMarkup(await RootLayout({ children: <Home /> }));
  const page = new DOMParser().parseFromString(markup, "text/html");

  expect(page.querySelector("header")?.textContent).toBe("Foodie.Demo");
});

test("a PILOT response removes demo wording but never enables ordering", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ mode: "PILOT", orderingEnabled: true })));
  const markup = renderToStaticMarkup(await RootLayout({ children: <Home /> }));
  const page = new DOMParser().parseFromString(markup, "text/html");

  expect(page.body.textContent).not.toMatch(/\bdemo\b/i);
  expect(metadata.description).not.toMatch(/\bdemo\b/i);
  expect(page.body.textContent).toContain("Ordering is not live yet");
});

test("sets the required browser security headers on all routes", async () => {
  vi.stubEnv("NODE_ENV", "production");
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

test.each([[undefined, "http://localhost:8080"], ["http://localhost:8081", "http://localhost:8081"]])(
  "preserves the same-origin API rewrite with FOODIE_API_ORIGIN=%s", async (origin, expected) => {
    vi.stubEnv("FOODIE_API_ORIGIN", origin);
    expect(await nextConfig.rewrites?.()).toEqual([{ source: "/api/:path*", destination: `${expected}/api/:path*` }]);
  },
);
