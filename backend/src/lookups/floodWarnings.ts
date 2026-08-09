import { fetchWithTimeout, now, errorMessage } from "../lib/http.js";
import type { LookupResult } from "../types.js";

export interface FloodWarning {
  floodAreaId: string;
  description: string;
  severity: string;
  severityLevel: number;
  message: string;
  timeRaised: string;
}

// Current flood warnings, checked live on every request against the
// Environment Agency's official Real Time flood-monitoring API (no key
// required). severityLevel: 1 severe, 2 warning, 3 alert, 4 no longer in force.
export async function getLiveFloodWarnings(
  latitude: number,
  longitude: number,
  distanceKm = 5,
): Promise<LookupResult<FloodWarning[]>> {
  const source = "Environment Agency Real Time flood-monitoring API";

  try {
    const url = `https://environment.data.gov.uk/flood-monitoring/id/floods?lat=${latitude}&long=${longitude}&dist=${distanceKm}`;
    const res = await fetchWithTimeout(url);

    if (!res.ok) {
      return {
        status: "unavailable",
        data: null,
        source,
        checkedAt: now(),
        error: `EA flood-monitoring API returned ${res.status}`,
      };
    }

    const json = (await res.json()) as any;
    const items: unknown[] = Array.isArray(json.items) ? json.items : [];

    const data: FloodWarning[] = items.map((raw) => {
      const item = raw as any;
      return {
        floodAreaId: item.floodAreaID ?? item.floodArea?.notation ?? "",
        description: item.description ?? "",
        severity: item.severity ?? "",
        severityLevel: item.severityLevel ?? 4,
        message: item.message ?? "",
        timeRaised: item.timeRaised ?? "",
      };
    });

    return { status: "ok", data, source, checkedAt: now() };
  } catch (err) {
    return { status: "error", data: null, source, checkedAt: now(), error: errorMessage(err) };
  }
}
