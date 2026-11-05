import { afterEach, expect, test, vi } from "vitest";
import { cartReducer, emptyCart, lineIdentity, type CartLine } from "./cartReducer";
import { CART_STORAGE_KEY, readCart, writeCart } from "./cartStorage";

const line: CartLine = {
  lineId: '["bowl",["avocado","tofu"]]', restaurantId: "green-table", menuItemId: "bowl",
  itemName: "Harvest bowl", unitPriceCents: 1200, quantity: 1,
  modifierOptionIds: ["avocado", "tofu"], modifierLabels: ["Avocado", "Tofu"], modifierTotalCents: 200,
};
const add = (value = line) => cartReducer(emptyCart, { type: "ADD_LINE", line: value });
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

test("adds a line without mutating the input and merges identical option sets", () => {
  const first = add();
  const next = cartReducer(first, { type: "ADD_LINE", line: { ...line, lineId: "untrusted", modifierOptionIds: ["tofu", "avocado"] } });
  expect(emptyCart).toEqual({ restaurantId: null, lines: [] });
  expect(first.lines[0].quantity).toBe(1);
  expect(next.lines).toHaveLength(1);
  expect(next.lines[0].quantity).toBe(2);
  expect(next.lines[0].lineId).toBe('["bowl",["avocado","tofu"]]');
});

test("line identity sorts options without changing inputs and avoids delimiter collisions", () => {
  const options = ["z", "a"];
  expect(lineIdentity("bowl", options)).toBe('["bowl",["a","z"]]');
  expect(options).toEqual(["z", "a"]);
  expect(lineIdentity("a:b", ["c"])).not.toBe(lineIdentity("a", ["b:c"]));
  expect(lineIdentity("a", ["b,c"])).not.toBe(lineIdentity("a", ["b", "c"]));
});

test("keeps different customization as separate lines", () => {
  const state = cartReducer(add(), { type: "ADD_LINE", line: { ...line, modifierOptionIds: [], modifierLabels: [], modifierTotalCents: 0 } });
  expect(state.lines).toHaveLength(2);
});

test("refuses a second restaurant without changing the cart", () => {
  const state = add();
  expect(cartReducer(state, { type: "ADD_LINE", line: { ...line, restaurantId: "another" } })).toBe(state);
});

test.each([0, -1, 21, 1.5, NaN, Infinity])("refuses invalid add quantity %s", (quantity) => {
  expect(cartReducer(emptyCart, { type: "ADD_LINE", line: { ...line, quantity } })).toBe(emptyCart);
});

test("caps the merged line at 20 by rejecting an overflowing add", () => {
  const state = add({ ...line, quantity: 20 });
  expect(cartReducer(state, { type: "ADD_LINE", line })).toBe(state);
});

test("updates a line quantity immutably and rejects invalid updates", () => {
  const state = add();
  const next = cartReducer(state, { type: "SET_QUANTITY", lineId: line.lineId, quantity: 20 });
  expect(next.lines[0].quantity).toBe(20);
  expect(state.lines[0].quantity).toBe(1);
  for (const quantity of [0, -1, 21, 1.5, NaN]) {
    expect(cartReducer(next, { type: "SET_QUANTITY", lineId: line.lineId, quantity })).toBe(next);
  }
});

test("removes the last line and clears the restaurant restriction", () => {
  const state = add();
  expect(cartReducer(state, { type: "REMOVE_LINE", lineId: line.lineId })).toEqual(emptyCart);
  expect(cartReducer(state, { type: "CLEAR" })).toEqual(emptyCart);
  expect(cartReducer(state, { type: "REMOVE_LINE", lineId: "missing" })).toBe(state);
});

test("persists and restores a valid versioned cart", () => {
  writeCart(add());
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toMatchObject({ version: 1 });
  expect(readCart()).toEqual(add());
});

test.each([
  "broken JSON", "null", "[]", JSON.stringify({ version: 2, state: { restaurantId: "green-table", lines: [line] } }),
  JSON.stringify({ version: 1, state: { restaurantId: "green-table", lines: [{ ...line, quantity: 21 }] } }),
  JSON.stringify({ version: 1, state: { restaurantId: "green-table", lines: [{ ...line, lineId: "forged" }] } }),
  JSON.stringify({ version: 1, state: { restaurantId: "green-table", lines: [{ ...line, restaurantId: "other" }] } }),
  JSON.stringify({ version: 1, state: { restaurantId: null, lines: [line] } }),
  JSON.stringify({ version: 1, state: { restaurantId: "green-table", lines: [] } }),
  JSON.stringify({ version: 1, state: { restaurantId: "green-table", lines: [line, line] } }),
  JSON.stringify({ version: 1, state: { restaurantId: "green-table", lines: [{ ...line, modifierOptionIds: ["tofu", "tofu"] }] } }),
  JSON.stringify({ version: 1, state: { restaurantId: "green-table", lines: [{ ...line, unitPriceCents: "1200" }] } }),
  JSON.stringify({ version: 1, state: { restaurantId: "green-table", lines: [{ ...line, modifierLabels: [] }] } }),
])("resets malformed or stale storage safely: %s", (stored) => {
  localStorage.setItem(CART_STORAGE_KEY, stored);
  expect(readCart()).toEqual(emptyCart);
});

test("survives unavailable browser storage on read and write", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  expect(readCart()).toEqual(emptyCart);
  expect(() => writeCart(add())).not.toThrow();
});
