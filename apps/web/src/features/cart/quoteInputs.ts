import type { DeliveryMode, QuoteRequest } from "../../lib/types";
import type { CartState } from "./cartReducer";

export function quoteInputs(state: CartState, locationId: string, mode: DeliveryMode): QuoteRequest | null {
  if (!state.restaurantId || !state.lines.length) return null;
  return {
    locationId, restaurantId: state.restaurantId, deliveryMode: mode,
    lines: state.lines.map(({ lineId, menuItemId, quantity, modifierOptionIds }) => ({
      lineId, menuItemId, quantity, modifierOptionIds: [...modifierOptionIds].sort(),
    })).sort((a, b) => a.lineId < b.lineId ? -1 : a.lineId > b.lineId ? 1 : 0),
  };
}

export const quoteFingerprint = (request: QuoteRequest | null) => request ? JSON.stringify(request) : null;
