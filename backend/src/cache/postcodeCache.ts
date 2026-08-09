import { getSupabaseServerClient } from "../lib/supabaseClient.js";

export interface CachedReport {
  postcode: string;
  report: unknown;
  generatedAt: string;
  expiresAt: string | null;
}

// Checked first on every request so repeat postcode searches skip straight
// to the saved result instead of re-running the live lookups.
export async function getCachedReport(postcode: string): Promise<CachedReport | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("postcode_cache")
    .select("postcode, report, generated_at, expires_at")
    .eq("postcode", postcode)
    .maybeSingle();

  if (error) {
    throw new Error(`postcode_cache lookup failed: ${error.message}`);
  }
  if (!data) return null;

  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return null; // stale entry, treat as a cache miss so it gets rebuilt
  }

  return {
    postcode: data.postcode,
    report: data.report,
    generatedAt: data.generated_at,
    expiresAt: data.expires_at,
  };
}

export async function saveReportToCache(
  postcode: string,
  report: unknown,
  ttlDays = 30,
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("postcode_cache").upsert(
    {
      postcode,
      report,
      generated_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: "postcode" },
  );

  if (error) {
    throw new Error(`postcode_cache write failed: ${error.message}`);
  }
}
