import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client";

export async function runMigrations(
  connectionString: string,
  migrationsFolder: string,
): Promise<void> {
  const db = createDb(connectionString);
  await migrate(db, { migrationsFolder });
  await db.$client.end();
}
