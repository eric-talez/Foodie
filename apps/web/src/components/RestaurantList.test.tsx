import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import RestaurantsPage from "../app/restaurants/page";
import { RestaurantList } from "./RestaurantList";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const locationId = "10000000-0000-0000-0000-000000000001";
const restaurant = {
  id: "20000000-0000-0000-0000-000000000001", slug: "green-table", name: "Green Table",
  description: "Fresh neighborhood bowls.", city: "Santa Clara", cuisine: "California",
  distanceMiles: 1.2, deliveryMode: "GROUPED", deliveryFeeCents: 199,
  estimatedMinutesMin: 45, estimatedMinutesMax: 60,
};
const grouped = { locationId, inCoverage: true, deliveryMode: "GROUPED", restaurants: [restaurant] };
const direct = { ...grouped, deliveryMode: "DIRECT", restaurants: [{ ...restaurant, deliveryMode: "DIRECT", deliveryFeeCents: 499, estimatedMinutesMin: 25, estimatedMinutesMax: 35 }] };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(grouped)));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("defaults to grouped and shows cuisine, distance, exact fee and ETA before selection", async () => {
  render(await RestaurantsPage({ searchParams: Promise.resolve({ locationId }) }));
  expect(screen.getByRole("radio", { name: "Grouped delivery" })).toBeChecked();
  expect(await screen.findByRole("link", { name: /Green Table/ })).toHaveAttribute("href", `/restaurants/green-table?locationId=${locationId}&mode=GROUPED`);
  expect(screen.getByText("California · Santa Clara")).toBeVisible();
  expect(screen.getByText("1.2 miles away")).toBeVisible();
  expect(screen.getByText("$1.99 delivery")).toBeVisible();
  expect(screen.getByText("45–60 min")).toBeVisible();
  expect(fetch).toHaveBeenCalledWith(`/api/v1/restaurants?locationId=${locationId}&mode=GROUPED`);
});

test("mode controls synchronize the URL and refetch direct prices and ETA", async () => {
  const view = render(<RestaurantList locationId={locationId} mode="GROUPED" />);
  await screen.findByText("$1.99 delivery");
  const control = screen.getByRole("radio", { name: "Direct delivery" });
  control.focus();
  expect(control).toHaveFocus();
  fireEvent.click(control);
  expect(replace).toHaveBeenCalledWith(`/restaurants?locationId=${locationId}&mode=DIRECT`, { scroll: false });
  vi.mocked(fetch).mockResolvedValue(response(direct));
  view.rerender(<RestaurantList locationId={locationId} mode="DIRECT" />);
  expect(screen.queryByText("$1.99 delivery")).not.toBeInTheDocument();
  expect(await screen.findByText("$4.99 delivery")).toBeVisible();
  expect(screen.getByText("25–35 min")).toBeVisible();
  expect(control).toBeChecked();
  expect(screen.getByRole("link", { name: /Green Table/ })).toHaveAttribute("href", `/restaurants/green-table?locationId=${locationId}&mode=DIRECT`);
  expect(fetch).toHaveBeenLastCalledWith(`/api/v1/restaurants?locationId=${locationId}&mode=DIRECT`);
});

test("renders direct query links in direct mode on first load", async () => {
  vi.mocked(fetch).mockResolvedValue(response(direct));
  render(await RestaurantsPage({ searchParams: Promise.resolve({ locationId, mode: "DIRECT" }) }));
  expect(screen.getByRole("radio", { name: "Direct delivery" })).toBeChecked();
  expect(await screen.findByText("$4.99 delivery")).toBeVisible();
});

test("announces loading without showing selectable restaurants", () => {
  vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
  render(<RestaurantList locationId={locationId} mode="GROUPED" />);
  expect(screen.getByRole("status")).toHaveTextContent(/loading nearby restaurants/i);
  expect(screen.queryByRole("link", { name: /Green Table/ })).not.toBeInTheDocument();
});

test("explains an empty result for a valid covered location", async () => {
  vi.mocked(fetch).mockResolvedValue(response({ ...grouped, restaurants: [] }));
  render(<RestaurantList locationId={locationId} mode="GROUPED" />);
  expect(await screen.findByText("No nearby restaurants for this delivery option")).toBeVisible();
});

test("distinguishes outside coverage and never shows restaurant links there", async () => {
  vi.mocked(fetch).mockResolvedValue(response({ ...grouped, inCoverage: false }));
  render(<RestaurantList locationId={locationId} mode="GROUPED" />);
  expect(await screen.findByText(/this location is outside our delivery coverage/i)).toBeVisible();
  expect(screen.queryByText("No nearby restaurants for this delivery option")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Green Table/ })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /choose another location/i })).toHaveAttribute("href", "/");
});

test("offers a keyboard-accessible retry after an API failure", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(response({ code: "TEMPORARY", message: "Please try again.", details: [] }, 503));
  render(<RestaurantList locationId={locationId} mode="GROUPED" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try again.");
  const retry = screen.getByRole("button", { name: "Retry" });
  retry.focus();
  expect(retry).toHaveFocus();
  fireEvent.click(retry);
  expect(await screen.findByText("$1.99 delivery")).toBeVisible();
});

test.each([
  {}, { locationId: "not-a-uuid" }, { locationId: [locationId, locationId] },
  { locationId, mode: "FAST" }, { locationId, mode: "" }, { locationId, mode: ["GROUPED", "DIRECT"] },
])("rejects invalid query values with a location-selection link: %j", async (query) => {
  render(await RestaurantsPage({ searchParams: Promise.resolve(query) }));
  expect(screen.getByRole("link", { name: /choose a location/i })).toHaveAttribute("href", "/");
  expect(fetch).not.toHaveBeenCalled();
});

test("ignores a stale grouped response after changing mode", async () => {
  let finishGrouped!: (value: Response) => void;
  vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { finishGrouped = resolve; })).mockResolvedValue(response(direct));
  const view = render(<RestaurantList locationId={locationId} mode="GROUPED" />);
  view.rerender(<RestaurantList locationId={locationId} mode="DIRECT" />);
  await screen.findByText("$4.99 delivery");
  await act(async () => { finishGrouped(response(grouped)); });
  expect(screen.queryByText("$1.99 delivery")).not.toBeInTheDocument();
  expect(screen.getByText("$4.99 delivery")).toBeVisible();
});

test.each([
  { ...grouped, deliveryMode: "DIRECT" },
  { ...grouped, locationId: "10000000-0000-0000-0000-000000000002" },
  { ...grouped, restaurants: [{ ...restaurant, deliveryFeeCents: -1 }] },
  { ...grouped, restaurants: [{ ...restaurant, estimatedMinutesMax: 20 }] },
])("does not expose malformed or mismatched API results as selectable restaurants: %j", async (body) => {
  vi.mocked(fetch).mockResolvedValue(response(body));
  render(<RestaurantList locationId={locationId} mode="GROUPED" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load restaurants/i);
  expect(screen.queryByRole("link", { name: /Green Table/ })).not.toBeInTheDocument();
});

test("formats a zero delivery fee as an exact dollar amount", async () => {
  vi.mocked(fetch).mockResolvedValue(response({ ...grouped, restaurants: [{ ...restaurant, deliveryFeeCents: 0 }] }));
  render(<RestaurantList locationId={locationId} mode="GROUPED" />);
  expect(await screen.findByText("$0.00 delivery")).toBeVisible();
});
