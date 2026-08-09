import { fetchWithTimeout, now, errorMessage } from "../lib/http.js";
import type { LookupResult } from "../types.js";

export interface AqmaData {
  inAqma: boolean;
  aqmaName: string | null;
  localAuthority: string | null;
  pollutants: string[] | null;
}

/**
 * Air quality problem area status ("Air Quality Management Area"), checked
 * live on every request per the brief.
 *
 * AQMA boundaries are published by DEFRA/UK-AIR as a point-in-polygon
 * queryable ArcGIS FeatureServer layer. The exact FeatureServer URL has
 * moved before, so it's read from AQMA_SERVICE_URL rather than hardcoded —
 * set it to the current "…/FeatureServer/0/query" endpoint. Field names in
 * the response (AQMA_Name, Local_Authority, Pollutants) are also unverified
 * here (no outbound network access in this environment) — confirm against a
 * live response and adjust the mapping below if they differ.
 */
export async function getAqmaStatus(
  latitude: number,
  longitude: number,
): Promise<LookupResult<AqmaData>> {
  const source = "DEFRA/UK-AIR AQMA boundaries";
  const baseUrl = process.env.AQMA_SERVICE_URL;

  if (!baseUrl) {
    return {
      status: "unavailable",
      data: null,
      source,
      checkedAt: now(),
      error: "AQMA_SERVICE_URL not configured",
    };
  }

  try {
    const params = new URLSearchParams({
      f: "json",
      geometry: `${longitude},${latitude}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: "false",
    });

    const res = await fetchWithTimeout(`${baseUrl}?${params.toString()}`);
    if (!res.ok) {
      return {
        status: "unavailable",
        data: null,
        source,
        checkedAt: now(),
        error: `AQMA service returned ${res.status}`,
      };
    }

    const json = (await res.json()) as any;
    const features: unknown[] = Array.isArray(json.features) ? json.features : [];

    if (features.length === 0) {
      return {
        status: "ok",
        data: { inAqma: false, aqmaName: null, localAuthority: null, pollutants: null },
        source,
        checkedAt: now(),
      };
    }

    const attrs = (features[0] as any).attributes ?? {};
    return {
      status: "ok",
      data: {
        inAqma: true,
        aqmaName: attrs.AQMA_Name ?? attrs.Name ?? null,
        localAuthority: attrs.Local_Authority ?? attrs.LA_Name ?? null,
        pollutants:
          typeof attrs.Pollutants === "string"
            ? attrs.Pollutants.split(",").map((p: string) => p.trim())
            : null,
      },
      source,
      checkedAt: now(),
    };
  } catch (err) {
    return { status: "error", data: null, source, checkedAt: now(), error: errorMessage(err) };
  }
}
