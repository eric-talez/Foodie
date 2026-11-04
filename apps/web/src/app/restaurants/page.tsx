import Link from "next/link";
import { RestaurantList } from "../../components/RestaurantList";
import { SiteHeader } from "../../components/SiteHeader";

export default async function RestaurantsPage({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locationId, mode = "GROUPED" } = await searchParams;
  const valid = typeof locationId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationId) &&
    (mode === "GROUPED" || mode === "DIRECT");

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container discovery-page" tabIndex={-1}>
        <p className="eyebrow">Your neighborhood, delivered</p>
        <h1>Nearby restaurants</h1>
        {valid ? <RestaurantList locationId={locationId.toLowerCase()} mode={mode} /> : (
          <div className="discovery-state">
            <h2>Choose a delivery location first</h2>
            <p>This restaurant link has a missing or invalid location or delivery option.</p>
            <Link href="/">Choose a location</Link>
          </div>
        )}
      </main>
    </>
  );
}
