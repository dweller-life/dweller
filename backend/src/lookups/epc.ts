import { fetchWithTimeout, now, errorMessage } from "../lib/http.js";
import type { LookupResult } from "../types.js";

export interface EpcData {
  uprn: string | null;
  postcode: string;
  addressLine1: string | null;
  wallType: string | null;
  wallInsulation: string | null;
  glazingType: string | null;
  heatingType: string | null;
  heatingFuel: string | null;
  builtYear: number | null;
  sapScore: number | null;
  epcBand: string | null;
}

// EPC lookup used as a fallback when we don't already have a cached EPC
// record for the property (epc_cache). Requires a free account at
// https://epc.opendatacommunities.org/ — set EPC_API_EMAIL / EPC_API_KEY.
// Server-side only; never expose these credentials to the frontend.
export async function lookupEpcFallback(postcode: string): Promise<LookupResult<EpcData[]>> {
  const source = "EPC Register (epc.opendatacommunities.org)";
  const email = process.env.EPC_API_EMAIL;
  const key = process.env.EPC_API_KEY;

  if (!email || !key) {
    return {
      status: "unavailable",
      data: null,
      source,
      checkedAt: now(),
      error: "EPC_API_EMAIL / EPC_API_KEY not configured",
    };
  }

  try {
    const auth = Buffer.from(`${email}:${key}`).toString("base64");
    const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${encodeURIComponent(postcode)}`;
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });

    if (res.status === 404) {
      return { status: "ok", data: [], source, checkedAt: now() };
    }
    if (!res.ok) {
      return {
        status: "unavailable",
        data: null,
        source,
        checkedAt: now(),
        error: `EPC API returned ${res.status}`,
      };
    }

    const json = (await res.json()) as any;
    const rows: unknown[] = Array.isArray(json.rows) ? json.rows : [];
    return { status: "ok", data: rows.map(mapEpcRow), source, checkedAt: now() };
  } catch (err) {
    return { status: "error", data: null, source, checkedAt: now(), error: errorMessage(err) };
  }
}

function mapEpcRow(row: any): EpcData {
  return {
    uprn: row.uprn ?? null,
    postcode: row.postcode,
    addressLine1: row.address1 ?? null,
    wallType: row["walls-description"] ?? null,
    wallInsulation: row["walls-energy-eff"] ?? null,
    glazingType: row["windows-description"] ?? null,
    heatingType: row["mainheat-description"] ?? null,
    heatingFuel: row["main-fuel"] ?? null,
    builtYear: parseConstructionAgeBand(row["construction-age-band"]),
    sapScore:
      row["current-energy-efficiency"] != null ? Number(row["current-energy-efficiency"]) : null,
    epcBand: row["current-energy-rating"] ?? null,
  };
}

// EPC's "construction-age-band" is a free-text range like
// "England and Wales: 1930-1949" — take the first year mentioned.
function parseConstructionAgeBand(band: unknown): number | null {
  if (typeof band !== "string") return null;
  const match = band.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}
