import { fetchWithTimeout, now, errorMessage } from "../lib/http.js";
import type { LookupResult } from "../types.js";

export type FloodRiskBand = "Very Low" | "Low" | "Medium" | "High" | "Unknown";

export interface FloodRiskData {
  riverAndSeaRisk: FloodRiskBand;
  surfaceWaterRisk: FloodRiskBand;
}

/**
 * Long-term flood risk band (river/sea + surface water), checked live on
 * every request per the brief ("checked live against the government's own
 * system, not stored in our own table").
 *
 * NOTE: unlike the flood-warnings lookup, the EA does not publish a simple
 * documented REST endpoint for the long-term risk band shown on
 * https://check-for-flooding.service.gov.uk — this calls the JSON endpoint
 * that service's own frontend uses. That endpoint isn't officially
 * documented and could not be verified against a live response in this
 * environment (no outbound network access here). Before relying on this in
 * production: confirm the URL and response field names still match by
 * checking a real response, and adjust `parseRiskWidgetResponse` if not.
 */
export async function getFloodRisk(
  easting: number,
  northing: number,
): Promise<LookupResult<FloodRiskData>> {
  const source = "check-for-flooding.service.gov.uk risk widget (unofficial endpoint)";

  try {
    const url = `https://check-for-flooding.service.gov.uk/risk-widget/${easting}/${northing}`;
    const res = await fetchWithTimeout(url);

    if (!res.ok) {
      return {
        status: "unavailable",
        data: null,
        source,
        checkedAt: now(),
        error: `flood risk service returned ${res.status}`,
      };
    }

    const json = (await res.json()) as any;
    return { status: "ok", data: parseRiskWidgetResponse(json), source, checkedAt: now() };
  } catch (err) {
    return { status: "error", data: null, source, checkedAt: now(), error: errorMessage(err) };
  }
}

function parseRiskWidgetResponse(json: any): FloodRiskData {
  return {
    riverAndSeaRisk: normalizeRiskBand(json?.riverAndSea ?? json?.riverSeaRisk),
    surfaceWaterRisk: normalizeRiskBand(json?.surfaceWater ?? json?.surfaceWaterRisk),
  };
}

function normalizeRiskBand(value: unknown): FloodRiskBand {
  const v = String(value ?? "").toLowerCase();
  if (v.includes("high")) return "High";
  if (v.includes("medium")) return "Medium";
  if (v.includes("very low")) return "Very Low";
  if (v.includes("low")) return "Low";
  return "Unknown";
}
