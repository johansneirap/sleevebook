import { fileURLToPath } from "node:url";
import { runMigrations } from "./migrate";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

await runMigrations(databaseUrl, migrationsFolder);
console.log("Migrations applied.");
