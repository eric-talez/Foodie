"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "../features/cart/CartProvider";
import { api } from "../lib/api";
import type { DeliveryMode, RestaurantMenu } from "../lib/types";
import { ItemCustomizer } from "./ItemCustomizer";
import { StatusMessage } from "./StatusMessage";

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function CartSummary({ locationId, mode }: { locationId: string; mode: DeliveryMode }) {
  const { state, ready, dispatch } = useCart();
  const subtotal = state.lines.reduce((sum, line) => sum + (line.unitPriceCents + line.modifierTotalCents) * line.quantity, 0);
  return <aside className="cart-summary" aria-labelledby="cart-title">
    <h2 id="cart-title">Your cart</h2>
    {!ready ? <StatusMessage>Loading saved cart…</StatusMessage> : !state.lines.length ? <p>Your cart is empty.</p> : <>
      <p className="estimate-note">One restaurant per cart. Prices are estimates until final pricing.</p>
      <ul className="cart-lines">
        {state.lines.map((line) => {
          const label = `${line.itemName}${line.modifierLabels.length ? ` (${line.modifierLabels.join(", ")})` : ""}`;
          return <li key={line.lineId}>
          <h3>{line.itemName}</h3>
          {!!line.modifierLabels.length && <p className="estimate-note">{line.modifierLabels.join(", ")}</p>}
          <p>{dollars((line.unitPriceCents + line.modifierTotalCents) * line.quantity)}</p>
          <label>Quantity for {label}
            <select value={line.quantity} onChange={(event) => dispatch({ type: "SET_QUANTITY", lineId: line.lineId, quantity: Number(event.target.value) })}>
              {Array.from({ length: 20 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
            </select>
          </label>
          <button className="cart-remove" type="button" aria-label={`Remove ${label}`} onClick={() => dispatch({ type: "REMOVE_LINE", lineId: line.lineId })}>Remove</button>
        </li>;
        })}
      </ul>
      <p className="cart-subtotal">Estimated food subtotal: {dollars(subtotal)}</p>
      <p className="estimate-note">Delivery fees are calculated later.</p>
      <button className="cart-remove" type="button" onClick={() => dispatch({ type: "CLEAR" })}>Clear cart</button>
      <Link className="cart-pricing-link" href={`/cart?${new URLSearchParams({ locationId, mode })}`}>Review cart pricing</Link>
    </>}
  </aside>;
}

export function MenuView({ slug, locationId, mode }: { slug: string; locationId: string; mode: DeliveryMode }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ slug: string; data?: RestaurantMenu; error?: string } | null>(null);
  useEffect(() => {
    let active = true;
    setResult(null);
    api.getRestaurant(slug).then(
      (data) => { if (active) setResult({ slug, data }); },
      (reason: unknown) => { if (active) setResult({ slug, error: reason instanceof Error ? reason.message : "Unable to load menu. Please try again." }); },
    );
    return () => { active = false; };
  }, [slug, attempt]);
  const current = result?.slug === slug ? result : null;
  const query = new URLSearchParams({ locationId, mode });

  return <>
    <Link className="menu-back" href={`/restaurants?${query}`}>← Back to restaurants</Link>
    <p className="eyebrow">{mode === "GROUPED" ? "Grouped" : "Direct"} delivery</p>
    <div className="menu-layout">
      <div>
        {!current ? <StatusMessage>Loading menu…</StatusMessage> : current.error ? <div className="discovery-state">
          <h1>Menu unavailable</h1>
          <StatusMessage error>{current.error}</StatusMessage>
          <button className="retry-button" type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
        </div> : current.data && <>
          <header className="menu-intro">
            <p className="restaurant-cuisine">{current.data.cuisine} · {current.data.city}</p>
            <h1>{current.data.name}</h1>
            <p>{current.data.description}</p>
          </header>
          {!current.data.categories.some((category) => category.items.length) && <StatusMessage>No menu items are available right now.</StatusMessage>}
          {current.data.categories.map((category) => category.items.length > 0 && <section className="menu-category" key={category.id} aria-labelledby={`category-${category.id}`}>
            <h2 id={`category-${category.id}`}>{category.name}</h2>
            <ul className="menu-items">
              {category.items.map((item) => <li className="menu-item" key={item.id}>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <ItemCustomizer key={`${slug}-${item.id}`} item={item} restaurantId={current.data!.id} />
              </li>)}
            </ul>
          </section>)}
        </>}
      </div>
      <CartSummary locationId={locationId} mode={mode} />
    </div>
  </>;
}
