import { createDb } from "@sleevebook/db";
import { downloadAndExtract } from "./download.js";
import { loadCatalogSource } from "./source.js";
import { upsertCatalog } from "./upsert.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  console.log("Downloading pokemon-tcg-data...");
  const extractedDir = await downloadAndExtract();

  console.log("Reading catalog source...");
  const source = await loadCatalogSource(extractedDir);

  const db = createDb(databaseUrl);
  try {
    console.log("Upserting catalog...");
    const summary = await upsertCatalog(db, source);
    console.log(summary);
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
