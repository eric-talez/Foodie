"use client";

import { createContext, useContext, useEffect, useReducer, useState, type Dispatch, type ReactNode } from "react";
import { cartReducer, emptyCart, type CartAction, type CartLine, type CartState } from "./cartReducer";
import { readCart, writeCart } from "./cartStorage";

const CartContext = createContext<{
  state: CartState;
  ready: boolean;
  dispatch: Dispatch<CartAction>;
  addLine: (line: CartLine) => boolean;
} | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer((current: CartState, action: CartAction | { type: "RESTORE"; state: CartState }) =>
    action.type === "RESTORE" ? action.state : cartReducer(current, action), emptyCart);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESTORE", state: readCart() });
    setReady(true);
  }, []);
  useEffect(() => { if (ready) writeCart(state); }, [state, ready]);

  function addLine(line: CartLine) {
    if (!ready || cartReducer(state, { type: "ADD_LINE", line }) === state) return false;
    dispatch({ type: "ADD_LINE", line });
    return true;
  }

  return <CartContext.Provider value={{ state, ready, dispatch, addLine }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart requires CartProvider");
  return cart;
}
