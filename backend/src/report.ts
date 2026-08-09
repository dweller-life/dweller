import { getCachedReport, saveReportToCache } from "./cache/postcodeCache.js";
import { geocodePostcode, type GeocodeData } from "./lookups/geocode.js";
import { lookupEpcFallback, type EpcData } from "./lookups/epc.js";
import { getFloodRisk, type FloodRiskData } from "./lookups/floodRisk.js";
import { getLiveFloodWarnings, type FloodWarning } from "./lookups/floodWarnings.js";
import { getAqmaStatus, type AqmaData } from "./lookups/aqma.js";
import type { LookupResult } from "./types.js";

export interface HomeReport {
  postcode: string;
  cacheHit: boolean;
  generatedAt: string;
  live: {
    location: LookupResult<GeocodeData>;
    epc: LookupResult<EpcData[]>;
    floodRisk: LookupResult<FloodRiskData>;
    floodWarnings: LookupResult<FloodWarning[]>;
    aqma: LookupResult<AqmaData>;
  };
  // Batch-built data (water quality, air pollution, noise, radon, etc.) is a
  // separate follow-up — this report currently covers only the live lookups.
}

function normalizePostcode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, " ");
}

function unavailableBecauseNoLocation<T>(source: string): LookupResult<T> {
  return {
    status: "unavailable",
    data: null,
    source,
    checkedAt: new Date().toISOString(),
    error: "geocoding failed, no coordinates available",
  };
}

export async function getHomeReport(rawPostcode: string): Promise<HomeReport> {
  const postcode = normalizePostcode(rawPostcode);

  // Check postcode_cache first so repeat searches skip the live lookups entirely.
  const cached = await getCachedReport(postcode).catch((err) => {
    console.warn(`postcode_cache read failed for ${postcode}: ${(err as Error).message}`);
    return null;
  });
  if (cached) {
    return { ...(cached.report as HomeReport), cacheHit: true };
  }

  // Cache miss: run the five live lookups. Geocoding runs first since flood
  // risk, flood warnings, and AQMA all need coordinates.
  const location = await geocodePostcode(postcode);

  const [epc, floodWarnings, aqma, floodRisk] = await Promise.all([
    lookupEpcFallback(postcode),
    location.data
      ? getLiveFloodWarnings(location.data.latitude, location.data.longitude)
      : Promise.resolve(
          unavailableBecauseNoLocation<FloodWarning[]>(
            "Environment Agency Real Time flood-monitoring API",
          ),
        ),
    location.data
      ? getAqmaStatus(location.data.latitude, location.data.longitude)
      : Promise.resolve(unavailableBecauseNoLocation<AqmaData>("DEFRA/UK-AIR AQMA boundaries")),
    location.data
      ? getFloodRisk(location.data.easting, location.data.northing)
      : Promise.resolve(
          unavailableBecauseNoLocation<FloodRiskData>(
            "check-for-flooding.service.gov.uk risk widget (unofficial endpoint)",
          ),
        ),
  ]);

  const report: HomeReport = {
    postcode,
    cacheHit: false,
    generatedAt: new Date().toISOString(),
    live: { location, epc, floodRisk, floodWarnings, aqma },
  };

  await saveReportToCache(postcode, report).catch((err) => {
    console.warn(`postcode_cache write failed for ${postcode}: ${(err as Error).message}`);
  });

  return report;
}
