"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "../features/cart/CartProvider";
import { quoteFingerprint, quoteInputs } from "../features/cart/quoteInputs";
import type { DeliveryMode } from "../lib/types";
import { QuoteSummary } from "./QuoteSummary";
import { StatusMessage } from "./StatusMessage";

export function CheckoutPreview({ locationId, mode }: { locationId: string; mode: DeliveryMode }) {
  const { state, ready, quote } = useCart();
  const router = useRouter();
  const fingerprint = ready ? quoteFingerprint(quoteInputs(state, locationId, mode)) : null;
  const current = fingerprint && quote?.fingerprint === fingerprint ? quote : null;
  const cartUrl = `/cart?${new URLSearchParams({ locationId, mode })}`;
  useEffect(() => { if (ready && !current) router.replace(cartUrl); }, [ready, current, router, cartUrl]);
  if (!current) return <StatusMessage>Returning to cart for current pricing…</StatusMessage>;
  return <>
    <Link className="menu-back" href={cartUrl}>Back to cart</Link>
    <h1>Checkout preview</h1>
    <p className="preview-notice">Ordering is not live yet</p>
    <p>This preview does not place orders or collect payment.</p>
    <div className="menu-layout">
      <section className="cart-summary cart-detail" aria-label="Preview items">
        <h2>Your items</h2>
        <ul className="cart-lines">{state.lines.map((line) => <li key={line.lineId}>
          <p>{line.itemName} × {line.quantity}</p>
          {!!line.modifierLabels.length && <p>{line.modifierLabels.join(", ")}</p>}
        </li>)}</ul>
      </section>
      <div className="cart-summary"><QuoteSummary quote={current.data} /></div>
    </div>
  </>;
}
