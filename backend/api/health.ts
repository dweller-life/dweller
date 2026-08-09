import type { VercelRequest, VercelResponse } from "@vercel/node";

// GET /api/health - quick check that the deployment and its required env
// vars are wired up, without exercising any of the live lookups.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const requiredEnv = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const;
  const optionalEnv = ["EPC_API_EMAIL", "EPC_API_KEY", "AQMA_SERVICE_URL"] as const;

  const missingRequired = requiredEnv.filter((key) => !process.env[key]);
  const missingOptional = optionalEnv.filter((key) => !process.env[key]);

  res.status(missingRequired.length === 0 ? 200 : 500).json({
    ok: missingRequired.length === 0,
    missingRequired,
    missingOptional,
  });
}
