"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "../features/cart/CartProvider";
import { quoteFingerprint, quoteInputs } from "../features/cart/quoteInputs";
import { api } from "../lib/api";
import type { DeliveryMode, QuoteRequest } from "../lib/types";
import { formatCents, QuoteSummary } from "./QuoteSummary";
import { StatusMessage } from "./StatusMessage";

interface QuoteFailure { message: string; unavailable: boolean; lineIds: string[]; itemIds: string[] }
function quoteFailure(reason: unknown): QuoteFailure {
  const error = reason as { code?: string; message?: string; details?: unknown[] } | null;
  const unavailable = error?.code === "ITEM_UNAVAILABLE";
  const details = unavailable && Array.isArray(error?.details) ? error.details.filter((value): value is Record<string, unknown> => !!value && typeof value === "object") : [];
  return {
    message: reason instanceof Error ? reason.message : "Unable to load pricing. Please try again.", unavailable,
    lineIds: details.flatMap((value) => typeof value.lineId === "string" ? [value.lineId] : []),
    itemIds: details.flatMap((value) => typeof value.menuItemId === "string" && typeof value.lineId !== "string" ? [value.menuItemId] : []),
  };
}

export function CartView({ locationId, mode }: { locationId: string; mode: DeliveryMode }) {
  const { state, ready, dispatch, quote, setQuote } = useCart();
  const router = useRouter();
  const fingerprint = ready ? quoteFingerprint(quoteInputs(state, locationId, mode)) : null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ fingerprint: string; attempt: number; error?: QuoteFailure } | null>(null);
  useEffect(() => {
    setQuote(null);
    setResult(null);
    if (!fingerprint) return;
    let active = true;
    const controller = new AbortController();
    api.createQuote(JSON.parse(fingerprint) as QuoteRequest, controller.signal).then(
      (data) => {
        if (active) { setQuote({ fingerprint, data }); setResult({ fingerprint, attempt }); }
      },
      (reason: unknown) => {
        if (active) { setQuote(null); setResult({ fingerprint, attempt, error: quoteFailure(reason) }); }
      },
    );
    return () => { active = false; controller.abort(); };
  }, [fingerprint, attempt, setQuote]);

  const current = result?.fingerprint === fingerprint && result.attempt === attempt ? result : null;
  const successful = current && !current.error && quote?.fingerprint === fingerprint ? quote : null;
  const query = new URLSearchParams({ locationId, mode });
  function retry() { setQuote(null); setAttempt((value) => value + 1); }

  return <>
    <h1>Your cart</h1>
    <div className="discovery-toolbar">
      <Link href={`/restaurants?${query}`}>Back to restaurants</Link>
      <Link href="/">Choose another location</Link>
    </div>
    {!ready ? <StatusMessage>Loading saved cart…</StatusMessage> : !state.lines.length ? <p>Your cart is empty.</p> : <div className="menu-layout">
      <section className="cart-summary cart-detail" aria-label="Cart items">
        <p className="estimate-note">Saved names and unit prices are estimates. Official pricing comes from the server below.</p>
        <ul className="cart-lines">{state.lines.map((line) => {
          const label = `${line.itemName}${line.modifierLabels.length ? ` (${line.modifierLabels.join(", ")})` : ""}`;
          return <li key={line.lineId}>
            <h2>{line.itemName}</h2>
            {!!line.modifierLabels.length && <p>{line.modifierLabels.join(", ")}</p>}
            <p className="estimate-note">Saved unit estimate: {formatCents(line.unitPriceCents + line.modifierTotalCents)}</p>
            <label>Quantity for {label}<select value={line.quantity} onChange={(event) => dispatch({ type: "SET_QUANTITY", lineId: line.lineId, quantity: Number(event.target.value) })}>
              {Array.from({ length: 20 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
            </select></label>
            <button className="cart-remove" type="button" aria-label={`Remove ${label}`} onClick={() => dispatch({ type: "REMOVE_LINE", lineId: line.lineId })}>Remove</button>
          </li>;
        })}</ul>
        <button className="cart-remove" type="button" onClick={() => dispatch({ type: "CLEAR" })}>Clear cart</button>
      </section>
      <div className="cart-summary" aria-live="polite" aria-atomic="true">
        {!current ? <StatusMessage>Loading server pricing…</StatusMessage> : current.error ? <>
          <StatusMessage error>{current.error.message}{current.error.unavailable && <>
            <span> Unavailable: {state.lines.filter((line) => current.error!.lineIds.includes(line.lineId) || current.error!.itemIds.includes(line.menuItemId)).map((line) => `${line.itemName}${line.modifierLabels.length ? ` (${line.modifierLabels.join(", ")})` : ""}`).join(", ") || "one or more cart items"}. Please remove or reconfigure unavailable items before continuing.</span>
          </>}</StatusMessage>
          {!current.error.unavailable && <button type="button" onClick={retry}>Retry pricing</button>}
        </> : successful && <QuoteSummary quote={successful.data} />}
      </div>
    </div>}
    <button className="checkout-action" type="button" disabled={!successful} onClick={() => { if (successful) router.push(`/checkout-preview?${query}`); }}>Continue to checkout preview</button>
  </>;
}
