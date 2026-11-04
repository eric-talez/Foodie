import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import Home from "./page";

vi.mock("../lib/api", () => ({ api: { getLocations: () => new Promise(() => {}) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

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
