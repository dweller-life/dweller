import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getHomeReport } from "../src/report.js";

// GET /api/report?postcode=SW1A+1AA
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed, use GET" });
    return;
  }

  const postcodeParam = req.query.postcode;
  const postcode = Array.isArray(postcodeParam) ? postcodeParam[0] : postcodeParam;

  if (!postcode || !postcode.trim()) {
    res.status(400).json({ error: "Missing required query param: postcode" });
    return;
  }

  try {
    const report = await getHomeReport(postcode);
    res.status(200).json(report);
  } catch (err) {
    console.error(`getHomeReport failed for "${postcode}":`, err);
    res.status(502).json({
      error: "Failed to build report",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

function setCorsHeaders(res: VercelResponse) {
  // Restrict to the deployed frontend origin in production by setting
  // ALLOWED_ORIGIN; defaults to "*" so the test page can call this from
  // anywhere while nothing else is configured yet.
  const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
