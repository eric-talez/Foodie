import { emptyCart, lineIdentity, validQuantity, type CartLine, type CartState } from "./cartReducer";

export const CART_STORAGE_KEY = "foodie.cart.v1";
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const money = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function validLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  return text(line.restaurantId) && text(line.menuItemId) && text(line.itemName) &&
    typeof line.quantity === "number" && validQuantity(line.quantity) &&
    money(line.unitPriceCents) && money(line.modifierTotalCents) &&
    Number.isSafeInteger((line.unitPriceCents + line.modifierTotalCents) * line.quantity) &&
    Array.isArray(line.modifierOptionIds) && line.modifierOptionIds.every(text) &&
    new Set(line.modifierOptionIds).size === line.modifierOptionIds.length &&
    Array.isArray(line.modifierLabels) && line.modifierLabels.every(text) &&
    line.modifierLabels.length === line.modifierOptionIds.length &&
    line.lineId === lineIdentity(line.menuItemId, line.modifierOptionIds);
}

export function readCart(): CartState {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "null");
    if (!stored || stored.version !== 1 || !stored.state || !Array.isArray(stored.state.lines)) return emptyCart;
    const { restaurantId, lines } = stored.state;
    if (lines.length === 0) return emptyCart;
    if (!text(restaurantId) || !lines.every(validLine) ||
        !lines.every((line: CartLine) => line.restaurantId === restaurantId) ||
        new Set(lines.map((line: CartLine) => line.lineId)).size !== lines.length) return emptyCart;
    // Persisted labels and prices are display hints; the server must price IDs and quantities.
    return { restaurantId, lines: lines.map((line: CartLine) => ({
      lineId: line.lineId, restaurantId, menuItemId: line.menuItemId, itemName: line.itemName,
      unitPriceCents: line.unitPriceCents, quantity: line.quantity,
      modifierOptionIds: line.modifierOptionIds, modifierLabels: line.modifierLabels, modifierTotalCents: line.modifierTotalCents,
    })) };
  } catch {
    return emptyCart;
  }
}

export function writeCart(state: CartState): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, state }));
  } catch {
    // The in-memory cart remains usable when storage is blocked or full.
  }
}
