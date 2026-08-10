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
// record for the property (epc_cache). Requires a Bearer token from
// https://get-energy-performance-data.communities.gov.uk/ — set EPC_API_TOKEN.
// Server-side only; never expose this credential to the frontend.
export async function lookupEpcFallback(postcode: string): Promise<LookupResult<EpcData[]>> {
  const source = "EPC Register (get-energy-performance-data.communities.gov.uk)";
  const token = process.env.EPC_API_TOKEN;

  if (!token) {
    return {
      status: "unavailable",
      data: null,
      source,
      checkedAt: now(),
      error: "EPC_API_TOKEN not configured",
    };
  }

  try {
    const url = new URL("https://api.get-energy-performance-data.communities.gov.uk/api/domestic/search");
    url.searchParams.set("postcode", postcode);
    const res = await fetchWithTimeout(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

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
    const rows: unknown[] = Array.isArray(json.data) ? json.data : [];
    return { status: "ok", data: rows.map(mapEpcRow), source, checkedAt: now() };
  } catch (err) {
    return { status: "error", data: null, source, checkedAt: now(), error: errorMessage(err) };
  }
}

// Field names below: uprn, postcode, addressLine1, currentEnergyEfficiencyBand
// are confirmed against the new API's docs. The rest (wall/glazing/heating/
// construction-age/SAP score) are carried over as camelCase guesses from the
// old opendatacommunities field names and are NOT verified against a live
// response — check these against real output before relying on them.
function mapEpcRow(row: any): EpcData {
  return {
    uprn: row.uprn ?? null,
    postcode: row.postcode,
    addressLine1: row.addressLine1 ?? null,
    wallType: row.wallsDescription ?? null,
    wallInsulation: row.wallsEnergyEfficiency ?? null,
    glazingType: row.windowsDescription ?? null,
    heatingType: row.mainHeatDescription ?? null,
    heatingFuel: row.mainFuel ?? null,
    builtYear: parseConstructionAgeBand(row.constructionAgeBand),
    sapScore: row.currentEnergyEfficiency != null ? Number(row.currentEnergyEfficiency) : null,
    epcBand: row.currentEnergyEfficiencyBand ?? null,
  };
}

// EPC's "constructionAgeBand" is a free-text range like
// "England and Wales: 1930-1949" — take the first year mentioned.
function parseConstructionAgeBand(band: unknown): number | null {
  if (typeof band !== "string") return null;
  const match = band.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}
