# Dweller backend

Database schema (`supabase/migrations/`) and the live-lookup API (`src/`, `api/`) described in
`DWELLER_PROJECT_BRIEF.md`.

## API

Deployed as Vercel serverless functions (root directory = `backend/`):

- `GET /api/report?postcode=SW1A+1AA` — returns a `HomeReport`. Checks `postcode_cache` first;
  on a miss it runs the five live lookups (geocode, EPC fallback, flood risk, flood warnings,
  AQMA) and writes the result back to the cache.
- `GET /api/health` — reports which required/optional env vars are missing, without exercising
  any live lookup. Use this first after a deploy.

## Environment variables

Set these in the Vercel project's Environment Variables settings — never commit real values.

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Safe to expose to the browser, but the backend also reads it. |
| `SUPABASE_SECRET_KEY` | yes | Server-side only. Bypasses RLS. Never prefix with `NEXT_PUBLIC_`. |
| `EPC_API_EMAIL` / `EPC_API_KEY` | no | EPC register fallback lookup. Without these, `epc` reports `status: "unavailable"` instead of failing the whole report. |
| `AQMA_SERVICE_URL` | no | ArcGIS FeatureServer query endpoint for DEFRA/UK-AIR AQMA boundaries. Same graceful-degradation behavior if unset. |
| `ALLOWED_ORIGIN` | no | CORS origin for `/api/report`. Defaults to `*`; set to the deployed frontend's origin once known. |

## Before trusting flood risk and AQMA in production

`src/lookups/floodRisk.ts` and `src/lookups/aqma.ts` call endpoints that don't have a clean,
officially documented API surface (see the comments in each file). Every other lookup
(postcodes.io, the EA flood-monitoring API, the EPC register) is a stable, documented public API.
None of the five were exercised against real data while building this — the sandbox this was
built in has no outbound network access to any of these hosts. Verify all five against real
postcodes once deployed, with particular scrutiny on flood risk and AQMA.

## Local development

```
npm install
npm run typecheck   # src/ + api/
npm run build:cli    # compiles src/ to dist/, for the CLI below
npm run report -- "SW1A 1AA"   # runs getHomeReport() locally, prints JSON
```

`npm run report` needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the environment
(and outbound network access) to do anything beyond exercising the error-handling paths.

## Deploying

1. In Vercel, create a project pointing at this repo with **root directory set to `backend/`**.
2. Add the environment variables above.
3. Deploy. `/api/health` should return `{ "ok": true, ... }`; if not, it lists which required
   vars are missing.
4. Hit `/api/report?postcode=<a real UK postcode>` and check each of the five `live.*` entries —
   `status: "ok"` with data, not `"unavailable"`/`"error"`.
