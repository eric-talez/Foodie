"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import type { LocationSummary } from "../lib/types";
import { StatusMessage } from "./StatusMessage";

export function LocationPicker() {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.getLocations().then(
      (data) => { if (active) setLocations(data); },
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load locations. Please try again later.");
      },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selected = locations.find((location) => location.id === locationId);

  function continueToRestaurants(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || loading || error) return;
    const query = new URLSearchParams({ locationId: selected.id, mode: "GROUPED" });
    router.push(`/restaurants?${query}`);
  }

  return (
    <section className="location-card" aria-labelledby="location-heading">
      <p className="eyebrow">Start close to home</p>
      <h2 id="location-heading">Choose your location</h2>
      <p id="location-help">Pick a sample delivery location to explore the demo. No address needed.</p>
      <form onSubmit={continueToRestaurants}>
        <label htmlFor="delivery-location">Demo delivery location</label>
        <select id="delivery-location" value={locationId} required
          disabled={loading || !!error || !locations.length}
          aria-describedby="location-help location-status"
          onChange={(event) => setLocationId(event.target.value)}>
          <option value="">Select a location</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.label} · {location.city}{location.inCoverage ? "" : " — Outside coverage"}
            </option>
          ))}
        </select>
        <div id="location-status">
          <StatusMessage>
            {loading ? "Loading locations…" : !error && !locations.length ? "No demo locations are available. Please try again later." : selected && !selected.inCoverage ? "This location is outside coverage. Delivery is unavailable; you can still view the coverage result." : ""}
          </StatusMessage>
          {error && <StatusMessage error>{error}</StatusMessage>}
        </div>
        <button type="submit" disabled={loading || !!error || !selected}>Find restaurants</button>
      </form>
      <p className="form-note">You’ll start with grouped delivery. Availability depends on your location.</p>
    </section>
  );
}
