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
