import { redirect } from "next/navigation";
import { CheckoutPreview } from "../../components/CheckoutPreview";
import { SiteHeader } from "../../components/SiteHeader";
import { deliveryContext } from "../../lib/deliveryContext";

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const context = deliveryContext(await searchParams);
  if (!context) redirect("/cart");
  return <><SiteHeader /><main id="main-content" className="container discovery-page" tabIndex={-1}><CheckoutPreview {...context} /></main></>;
}
