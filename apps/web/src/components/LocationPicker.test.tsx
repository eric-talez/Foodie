import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../lib/api";
import { LocationPicker } from "./LocationPicker";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../lib/api", () => ({ api: { getLocations: vi.fn() } }));

const locations = [
  { id: "10000000-0000-0000-0000-000000000001", label: "Santa Clara Central — demo location", city: "Santa Clara", inCoverage: true },
  { id: "10000000-0000-0000-0000-000000000002", label: "Downtown San Jose — demo location", city: "San Jose", inCoverage: true },
  { id: "10000000-0000-0000-0000-000000000003", label: "North San Jose — demo location", city: "San Jose", inCoverage: true },
  { id: "10000000-0000-0000-0000-000000000004", label: "San Francisco — outside demo coverage", city: "San Francisco", inCoverage: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getLocations).mockResolvedValue(locations);
});
afterEach(cleanup);

test("announces loading and prevents continuation while loading", () => {
  vi.mocked(api.getLocations).mockReturnValue(new Promise(() => {}));
  render(<LocationPicker />);
  expect(screen.getByRole("status")).toHaveTextContent(/loading locations/i);
  expect(screen.getByRole("button", { name: "Find restaurants" })).toBeDisabled();
  expect(screen.getByLabelText("Demo delivery location")).toBeDisabled();
});

test("labels all four locations and explicitly identifies outside coverage", async () => {
  render(<LocationPicker />);
  await screen.findByRole("option", { name: /Santa Clara Central/ });
  for (const location of locations) {
    expect(screen.getByRole("option", { name: new RegExp(location.label) })).toHaveValue(location.id);
  }
  expect(screen.getByRole("option", { name: /outside coverage/i })).toHaveValue(locations[3].id);
  expect(screen.getByRole("button", { name: "Find restaurants" })).toBeDisabled();
});

test("native labeled controls submit the selected location and grouped mode", async () => {
  render(<LocationPicker />);
  const select = await screen.findByRole("combobox", { name: "Demo delivery location" });
  await waitFor(() => expect(select).toBeEnabled());
  expect(select.tagName).toBe("SELECT");
  select.focus();
  expect(select).toHaveFocus();
  fireEvent.change(select, { target: { value: locations[1].id } });
  const button = screen.getByRole("button", { name: "Find restaurants" });
  expect(button).toBeEnabled();
  button.focus();
  expect(button).toHaveFocus();
  expect(button).toHaveAttribute("type", "submit");
  fireEvent.submit(button.closest("form")!);
  expect(push).toHaveBeenCalledWith("/restaurants?locationId=10000000-0000-0000-0000-000000000002&mode=GROUPED");
});

test("keeps outside coverage selectable and explains the empty delivery result", async () => {
  render(<LocationPicker />);
  const option = await screen.findByRole("option", { name: /outside coverage/i });
  fireEvent.change(screen.getByLabelText("Demo delivery location"), { target: { value: (option as HTMLOptionElement).value } });
  expect(screen.getByRole("status")).toHaveTextContent(/delivery is unavailable/i);
  fireEvent.click(screen.getByRole("button", { name: "Find restaurants" }));
  expect(push).toHaveBeenCalledWith("/restaurants?locationId=10000000-0000-0000-0000-000000000004&mode=GROUPED");
});

test("announces API failure and prevents continuing", async () => {
  vi.mocked(api.getLocations).mockRejectedValue(new Error("Locations are temporarily unavailable."));
  render(<LocationPicker />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Locations are temporarily unavailable.");
  expect(screen.getByRole("button", { name: "Find restaurants" })).toBeDisabled();
});

test("explains an empty location list", async () => {
  vi.mocked(api.getLocations).mockResolvedValue([]);
  render(<LocationPicker />);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/no demo locations are available/i));
  expect(screen.getByRole("button", { name: "Find restaurants" })).toBeDisabled();
});
