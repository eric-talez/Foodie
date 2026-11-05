"use client";

import { createContext, useCallback, useContext, useEffect, useReducer, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { cartReducer, emptyCart, type CartAction, type CartLine, type CartState } from "./cartReducer";
import { readCart, writeCart } from "./cartStorage";
import type { QuoteResponse } from "../../lib/types";

interface SuccessfulQuote { fingerprint: string; data: QuoteResponse }

const CartContext = createContext<{
  state: CartState;
  ready: boolean;
  dispatch: Dispatch<CartAction>;
  addLine: (line: CartLine) => boolean;
  quote: SuccessfulQuote | null;
  setQuote: Dispatch<SetStateAction<SuccessfulQuote | null>>;
} | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, reduce] = useReducer((current: CartState, action: CartAction | { type: "RESTORE"; state: CartState }) =>
    action.type === "RESTORE" ? action.state : cartReducer(current, action), emptyCart);
  const [ready, setReady] = useState(false);
  const [quote, setQuote] = useState<SuccessfulQuote | null>(null);
  const dispatch = useCallback((action: CartAction) => {
    setQuote(null);
    reduce(action);
  }, []);

  useEffect(() => {
    reduce({ type: "RESTORE", state: readCart() });
    setReady(true);
  }, []);
  useEffect(() => { if (ready) writeCart(state); }, [state, ready]);

  function addLine(line: CartLine) {
    if (!ready || cartReducer(state, { type: "ADD_LINE", line }) === state) return false;
    dispatch({ type: "ADD_LINE", line });
    return true;
  }

  return <CartContext.Provider value={{ state, ready, dispatch, addLine, quote, setQuote }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart requires CartProvider");
  return cart;
}
