import type { ApiError, DeliveryMode, LocationSummary, RestaurantSearchResponse } from "./types";

const locationError = "Unable to load locations. Please try again later.";

export const api = {
  async getLocations(): Promise<LocationSummary[]> {
    const response = await fetch("/api/v1/locations");
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      if (body && typeof body === "object" && "code" in body &&
          typeof body.code === "string" && "message" in body &&
          typeof body.message === "string" && body.message.trim() &&
          "details" in body && Array.isArray(body.details)) {
        const error: ApiError = { code: body.code, message: body.message, details: body.details };
        throw Object.assign(new Error(error.message), error);
      }
      throw new Error(locationError);
    }

    if (!Array.isArray(body) || !body.every((location) =>
      location && typeof location === "object" &&
      typeof location.id === "string" && typeof location.label === "string" &&
      typeof location.city === "string" && typeof location.inCoverage === "boolean"
    )) {
      throw new Error(locationError);
    }
    return body;
  },

  async getRestaurants(locationId: string, mode: DeliveryMode): Promise<RestaurantSearchResponse> {
    const fallback = "Unable to load restaurants. Please try again.";
    const query = new URLSearchParams({ locationId, mode });
    const response = await fetch(`/api/v1/restaurants?${query}`);
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      if (body && typeof body === "object" && "code" in body &&
          typeof body.code === "string" && "message" in body &&
          typeof body.message === "string" && body.message.trim() &&
          "details" in body && Array.isArray(body.details)) {
        const error: ApiError = { code: body.code, message: body.message, details: body.details };
        throw Object.assign(new Error(error.message), error);
      }
      throw new Error(fallback);
    }

    if (!body || typeof body !== "object" ||
        !("locationId" in body) || body.locationId !== locationId ||
        !("deliveryMode" in body) || body.deliveryMode !== mode ||
        !("inCoverage" in body) || typeof body.inCoverage !== "boolean" ||
        !("restaurants" in body) || !Array.isArray(body.restaurants) ||
        !body.restaurants.every((restaurant) =>
          restaurant && typeof restaurant === "object" &&
          typeof restaurant.id === "string" && typeof restaurant.slug === "string" && restaurant.slug.length > 0 &&
          typeof restaurant.name === "string" && typeof restaurant.description === "string" &&
          typeof restaurant.city === "string" && typeof restaurant.cuisine === "string" &&
          Number.isFinite(restaurant.distanceMiles) && restaurant.distanceMiles >= 0 &&
          restaurant.deliveryMode === mode &&
          Number.isSafeInteger(restaurant.deliveryFeeCents) && restaurant.deliveryFeeCents >= 0 &&
          Number.isSafeInteger(restaurant.estimatedMinutesMin) && restaurant.estimatedMinutesMin >= 0 &&
          Number.isSafeInteger(restaurant.estimatedMinutesMax) && restaurant.estimatedMinutesMax >= restaurant.estimatedMinutesMin
        )) {
      throw new Error(fallback);
    }
    return body as RestaurantSearchResponse;
  },
};
