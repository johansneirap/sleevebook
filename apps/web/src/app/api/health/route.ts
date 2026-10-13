import { sql } from "drizzle-orm";
import packageJson from "../../../../package.json";
import { db } from "../../../lib/db";

export async function GET(): Promise<Response> {
  let dbStatus: "ok" | "error" = "ok";
  try {
    await db.execute(sql`select 1`);
  } catch {
    dbStatus = "error";
  }

  return Response.json({ status: "ok", db: dbStatus, version: packageJson.version });
}
