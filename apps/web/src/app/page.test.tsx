import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import Home from "./page";

afterEach(cleanup);

test("identifies Foodie and tells customers ordering is not live", () => {
  render(<Home />);

  expect(screen.getByRole("heading", { name: "Foodie" })).toBeInTheDocument();
  expect(screen.getByText("Ordering is not live yet")).toBeInTheDocument();
});
