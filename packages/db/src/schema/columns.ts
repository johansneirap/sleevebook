import { uuid } from "drizzle-orm/pg-core";

// Generated in the application, not via a Postgres extension (e.g. pgcrypto),
// so the schema stays portable to any standard Postgres instance.
export function uuidPk() {
  return uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
}
