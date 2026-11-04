"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import type { DeliveryMode, RestaurantSearchResponse } from "../lib/types";
import { DeliveryModeToggle } from "./DeliveryModeToggle";
import { RestaurantCard } from "./RestaurantCard";
import { StatusMessage } from "./StatusMessage";

export function RestaurantList({ locationId, mode }: { locationId: string; mode: DeliveryMode }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    locationId: string;
    mode: DeliveryMode;
    data?: RestaurantSearchResponse;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    setResult(null);
    api.getRestaurants(locationId, mode).then(
      (data) => { if (active) setResult({ locationId, mode, data }); },
      (reason: unknown) => {
        if (active) setResult({ locationId, mode, error: reason instanceof Error ? reason.message : "Unable to load restaurants. Please try again." });
      },
    );
    return () => { active = false; };
  }, [locationId, mode, attempt]);

  // Hide the previous query's cards during the render before its effect runs.
  const current = result?.locationId === locationId && result.mode === mode ? result : null;

  function changeMode(nextMode: DeliveryMode) {
    const query = new URLSearchParams({ locationId, mode: nextMode });
    router.replace(`/restaurants?${query}`, { scroll: false });
  }

  return (
    <>
      <div className="discovery-toolbar">
        <DeliveryModeToggle mode={mode} onChange={changeMode} />
        <Link className="change-location" href="/">Choose another location</Link>
      </div>
      {!current ? <StatusMessage>Loading nearby restaurants…</StatusMessage> : current.error ? (
        <div className="discovery-state">
          <StatusMessage error>{current.error}</StatusMessage>
          <button className="retry-button" type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
        </div>
      ) : !current.data?.inCoverage ? (
        <div className="discovery-state">
          <StatusMessage>This location is outside our delivery coverage. Choose another location to explore delivery options.</StatusMessage>
        </div>
      ) : !current.data.restaurants.length ? (
        <div className="discovery-state">
          <StatusMessage>No nearby restaurants for this delivery option</StatusMessage>
        </div>
      ) : (
        <>
          <StatusMessage>{current.data.restaurants.length} nearby {current.data.restaurants.length === 1 ? "restaurant" : "restaurants"} · {mode === "GROUPED" ? "Grouped" : "Direct"} delivery</StatusMessage>
          <ul className="restaurant-grid" aria-label="Nearby restaurants">
            {current.data.restaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} locationId={locationId} />)}
          </ul>
        </>
      )}
    </>
  );
}
