export type RuntimeMode = "DEMO" | "PILOT";

export async function getRuntime(): Promise<{ mode: RuntimeMode; orderingEnabled: boolean }> {
  const origin = process.env.FOODIE_API_ORIGIN ?? "http://localhost:8080";
  try {
    const response = await fetch(`${origin}/api/v1/runtime`, {
      cache: "no-store", signal: AbortSignal.timeout(3000),
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
  return { mode: "DEMO", orderingEnabled: false };
}
