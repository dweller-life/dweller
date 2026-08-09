export { getHomeReport } from "./report.js";
export type { HomeReport } from "./report.js";

// Manual test run: `npm run build:cli && SUPABASE_SECRET_KEY=... npm run report -- "SW1A 1AA"`
const isDirectRun = process.argv[1]?.endsWith("index.js");
if (isDirectRun) {
  const postcode = process.argv.slice(2).join(" ");
  if (!postcode) {
    console.error("Usage: npm run report -- <postcode>");
    process.exit(1);
  }

  const { getHomeReport } = await import("./report.js");
  getHomeReport(postcode)
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
