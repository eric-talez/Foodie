export interface LocationSummary {
  id: string;
  label: string;
  city: string;
  inCoverage: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details: unknown[];
}

export type DeliveryMode = "GROUPED" | "DIRECT";

export interface RestaurantSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  city: string;
  cuisine: string;
  distanceMiles: number;
  deliveryMode: DeliveryMode;
  deliveryFeeCents: number;
  estimatedMinutesMin: number;
  estimatedMinutesMax: number;
}

export interface RestaurantSearchResponse {
  locationId: string;
  inCoverage: boolean;
  deliveryMode: DeliveryMode;
  restaurants: RestaurantSummary[];
}

export interface ModifierOption {
  id: string;
  label: string;
  priceDeltaCents: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageReference: string | null;
  modifierGroups: ModifierGroup[];
}

export interface RestaurantMenu {
  id: string;
  slug: string;
  name: string;
  description: string;
  city: string;
  cuisine: string;
  categories: { id: string; name: string; items: MenuItem[] }[];
}
