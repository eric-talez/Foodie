import type { DeliveryMode } from "./types";

export function deliveryContext({ locationId, mode = "GROUPED" }: { [key: string]: string | string[] | undefined }): { locationId: string; mode: DeliveryMode } | null {
  if (typeof locationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationId) ||
      (mode !== "GROUPED" && mode !== "DIRECT")) return null;
  return { locationId: locationId.toLowerCase(), mode };
}
