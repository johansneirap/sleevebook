import { fileURLToPath } from "node:url";
import { createDb } from "@sleevebook/db";
import { migrateTracker } from "./migrate";
import { loadSeedTracker } from "./seed-schema";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const seedPath = fileURLToPath(new URL("../../../../seed/master-sets.json", import.meta.url));
  console.log(`Loading ${seedPath}...`);
  const seed = await loadSeedTracker(seedPath);

  const db = createDb(databaseUrl);
  try {
    console.log("Migrating tracker...");
    const summary = await migrateTracker(db, seed);
    console.log(summary);
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
