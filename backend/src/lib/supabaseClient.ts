import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Server-side only. SUPABASE_SECRET_KEY bypasses Row Level Security and must
// never be read outside backend code or shipped to the browser — only
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is safe for the frontend.
export function getSupabaseServerClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY must be set as environment variables",
    );
  }

  client = createClient(url, secretKey, {
    auth: { persistSession: false },
  });
  return client;
}
