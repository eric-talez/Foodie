import type { ApiError, LocationSummary } from "./types";

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
};
