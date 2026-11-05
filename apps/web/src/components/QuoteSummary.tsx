import { useContext } from "react";
import { RuntimeModeContext } from "../lib/RuntimeModeContext";
import type { QuoteResponse } from "../lib/types";

export const formatCents = (cents: number) => new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(cents / 100);

export function QuoteSummary({ quote }: { quote: QuoteResponse }) {
  const mode = useContext(RuntimeModeContext);
  return <section className="quote-summary" aria-labelledby="quote-title">
    <h2 id="quote-title">{mode === "DEMO" ? "Demo pricing" : "Estimated pricing"}</h2>
    <p>{quote.deliveryMode === "GROUPED" ? "Grouped" : "Direct"} delivery</p>
    <p>Estimated arrival: {quote.estimatedMinutesMin}–{quote.estimatedMinutesMax} minutes</p>
    <dl className="quote-money">
      <dt>Food subtotal</dt><dd>{formatCents(quote.subtotalCents)}</dd>
      <dt>Service fee</dt><dd>{formatCents(quote.serviceFeeCents)}</dd>
      <dt>Delivery fee</dt><dd>{formatCents(quote.deliveryFeeCents)}</dd>
      <dt>Estimated tax</dt><dd>{formatCents(quote.estimatedTaxCents)}</dd>
      <dt className="quote-total">Total</dt><dd className="quote-total">{formatCents(quote.totalCents)}</dd>
    </dl>
  </section>;
}
