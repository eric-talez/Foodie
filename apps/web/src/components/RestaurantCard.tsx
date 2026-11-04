import Link from "next/link";
import type { RestaurantSummary } from "../lib/types";

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function RestaurantCard({ restaurant, locationId }: {
  restaurant: RestaurantSummary;
  locationId: string;
}) {
  const query = new URLSearchParams({ locationId, mode: restaurant.deliveryMode });

  return (
    <li>
      <Link className="restaurant-card" href={`/restaurants/${encodeURIComponent(restaurant.slug)}?${query}`}>
        <div className="restaurant-mark" aria-hidden="true">{restaurant.name.slice(0, 1)}</div>
        <div className="restaurant-info">
          <p className="restaurant-cuisine">{restaurant.cuisine} · {restaurant.city}</p>
          <h2>{restaurant.name}</h2>
          <p className="restaurant-description">{restaurant.description}</p>
          <p className="restaurant-distance">{restaurant.distanceMiles} miles away</p>
          <div className="restaurant-delivery">
            <strong>{dollars.format(restaurant.deliveryFeeCents / 100)} delivery</strong>
            <span>{restaurant.estimatedMinutesMin}–{restaurant.estimatedMinutesMax} min</span>
          </div>
          <span className="restaurant-action">View menu <span aria-hidden="true">↗</span></span>
        </div>
      </Link>
    </li>
  );
}
