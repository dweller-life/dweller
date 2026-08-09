import { fetchWithTimeout, now, errorMessage } from "../lib/http.js";
import type { LookupResult } from "../types.js";

export interface GeocodeData {
  postcode: string;
  latitude: number;
  longitude: number;
  easting: number;
  northing: number;
  adminDistrict: string | null;
  adminWard: string | null;
  parliamentaryConstituency: string | null;
}

// Exact location, checked live on every request. postcodes.io is the free,
// no-key-required UK postcode geocoder.
export async function geocodePostcode(postcode: string): Promise<LookupResult<GeocodeData>> {
  const source = "postcodes.io";
  const cleaned = postcode.trim();

  try {
    const res = await fetchWithTimeout(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`,
    );

    if (res.status === 404) {
      return { status: "ok", data: null, source, checkedAt: now(), error: "postcode not found" };
    }
    if (!res.ok) {
      return {
        status: "unavailable",
        data: null,
        source,
        checkedAt: now(),
        error: `postcodes.io returned ${res.status}`,
      };
    }

    const json = (await res.json()) as any;
    const r = json.result;
    if (!r) {
      return { status: "ok", data: null, source, checkedAt: now(), error: "postcode not found" };
    }

    return {
      status: "ok",
      data: {
        postcode: r.postcode,
        latitude: r.latitude,
        longitude: r.longitude,
        easting: r.eastings,
        northing: r.northings,
        adminDistrict: r.admin_district ?? null,
        adminWard: r.admin_ward ?? null,
        parliamentaryConstituency: r.parliamentary_constituency ?? null,
      },
      source,
      checkedAt: now(),
    };
  } catch (err) {
    return { status: "error", data: null, source, checkedAt: now(), error: errorMessage(err) };
  }
}
