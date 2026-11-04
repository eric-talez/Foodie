import Link from "next/link";
import { MenuView } from "../../../components/MenuView";
import { SiteHeader } from "../../../components/SiteHeader";

export default async function RestaurantPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ slug }, { locationId, mode = "GROUPED" }] = await Promise.all([params, searchParams]);
  const valid = typeof locationId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationId) &&
    (mode === "GROUPED" || mode === "DIRECT");
  return <>
    <SiteHeader />
    <main id="main-content" className="container discovery-page" tabIndex={-1}>
      {valid ? <MenuView slug={slug} locationId={locationId.toLowerCase()} mode={mode} /> : <div className="discovery-state">
        <h1>Choose a delivery location first</h1>
        <p>This menu link has a missing or invalid location or delivery option.</p>
        <Link href="/">Choose a location</Link>
      </div>}
    </main>
  </>;
}
