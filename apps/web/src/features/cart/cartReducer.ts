export interface CartLine {
  lineId: string;
  restaurantId: string;
  menuItemId: string;
  itemName: string;
  unitPriceCents: number;
  quantity: number;
  modifierOptionIds: string[];
  modifierLabels: string[];
  modifierTotalCents: number;
}

export interface CartState {
  restaurantId: string | null;
  lines: CartLine[];
}

export type CartAction =
  | { type: "ADD_LINE"; line: CartLine }
  | { type: "SET_QUANTITY"; lineId: string; quantity: number }
  | { type: "REMOVE_LINE"; lineId: string }
  | { type: "CLEAR" };

export const emptyCart: CartState = { restaurantId: null, lines: [] };
export const validQuantity = (value: number) => Number.isInteger(value) && value >= 1 && value <= 20;

export function lineIdentity(menuItemId: string, optionIds: string[]): string {
  return JSON.stringify([menuItemId, [...optionIds].sort()]);
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_LINE": {
      const line = action.line;
      if (!validQuantity(line.quantity) || (state.restaurantId !== null && state.restaurantId !== line.restaurantId)) return state;
      const lineId = lineIdentity(line.menuItemId, line.modifierOptionIds);
      const existing = state.lines.find((value) => value.lineId === lineId);
      if (existing) {
        const quantity = existing.quantity + line.quantity;
        if (!validQuantity(quantity)) return state;
        return { ...state, lines: state.lines.map((value) => value.lineId === lineId ? { ...value, quantity } : value) };
      }
      return { restaurantId: line.restaurantId, lines: [...state.lines, {
        ...line, lineId, modifierOptionIds: [...line.modifierOptionIds], modifierLabels: [...line.modifierLabels],
      }] };
    }
    case "SET_QUANTITY":
      if (!validQuantity(action.quantity) || !state.lines.some((line) => line.lineId === action.lineId)) return state;
      return { ...state, lines: state.lines.map((line) => line.lineId === action.lineId ? { ...line, quantity: action.quantity } : line) };
    case "REMOVE_LINE": {
      const lines = state.lines.filter((line) => line.lineId !== action.lineId);
      if (lines.length === state.lines.length) return state;
      return lines.length ? { ...state, lines } : emptyCart;
    }
    case "CLEAR": return emptyCart;
  }
}
