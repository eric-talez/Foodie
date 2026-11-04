import type { ApiError, DeliveryMode, LocationSummary, RestaurantMenu, RestaurantSearchResponse } from "./types";

const locationError = "Unable to load locations. Please try again later.";

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object";
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const nonnegativeInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function validMenu(body: unknown, slug: string): body is RestaurantMenu {
  if (!record(body) || !text(body.id) || body.slug !== slug || !text(body.name) ||
      typeof body.description !== "string" || !text(body.city) || !text(body.cuisine) || !Array.isArray(body.categories)) return false;
  return body.categories.every((category) => record(category) && text(category.id) && text(category.name) &&
    Array.isArray(category.items) && category.items.every((item) => record(item) && text(item.id) && text(item.name) &&
      typeof item.description === "string" && nonnegativeInteger(item.priceCents) &&
      (item.imageReference === null || typeof item.imageReference === "string") &&
      Array.isArray(item.modifierGroups) && item.modifierGroups.every((group) => record(group) && text(group.id) && text(group.name) &&
        nonnegativeInteger(group.minSelections) && nonnegativeInteger(group.maxSelections) && group.maxSelections >= group.minSelections &&
        Array.isArray(group.options) && group.options.every((option) => record(option) && text(option.id) && text(option.label) && nonnegativeInteger(option.priceDeltaCents))
      )
    )
  );
}

export const api = {
  async getRestaurant(slug: string): Promise<RestaurantMenu> {
    const fallback = "Unable to load menu. Please try again.";
    const response = await fetch(`/api/v1/restaurants/${encodeURIComponent(slug)}`);
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (record(body) && typeof body.code === "string" && text(body.message) && Array.isArray(body.details)) {
        const error: ApiError = { code: body.code, message: body.message, details: body.details };
        throw Object.assign(new Error(error.message), error);
      }
      throw new Error(fallback);
    }
    if (!validMenu(body, slug)) throw new Error(fallback);
    return body;
  },

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
