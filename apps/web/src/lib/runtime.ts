import "server-only";
import { parseApiOrigin } from "./apiOrigin";

export type RuntimeMode = "DEMO" | "PILOT";

export async function getRuntime(): Promise<{ mode: RuntimeMode; orderingEnabled: boolean }> {
  const fallback = { mode: "DEMO", orderingEnabled: false } as const;
  const origin = parseApiOrigin(process.env.FOODIE_BUILD_API_ORIGIN);
  if (!origin) return fallback;
  try {
    const response = await fetch(`${origin}/api/v1/runtime`, {
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 2 &&
          "mode" in body && (body.mode === "DEMO" || body.mode === "PILOT") &&
          "orderingEnabled" in body && typeof body.orderingEnabled === "boolean") {
        return { mode: body.mode, orderingEnabled: body.orderingEnabled };
      }
    }
  } catch {
    // A missing runtime response must not prevent rendering the preview.
  }
  return fallback;
}
