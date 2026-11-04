import Link from "next/link";
import { CartView } from "../../components/CartView";
import { SiteHeader } from "../../components/SiteHeader";
import { deliveryContext } from "../../lib/deliveryContext";

export default async function CartPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const context = deliveryContext(await searchParams);
  return <><SiteHeader /><main id="main-content" className="container discovery-page" tabIndex={-1}>
    {context ? <CartView {...context} /> : <div className="discovery-state">
      <h1>Choose a delivery location first</h1>
      <p>Your saved cart is kept. Choose a location and delivery option to review pricing.</p>
      <Link href="/">Choose a location</Link>
    </div>}
  </main></>;
}
