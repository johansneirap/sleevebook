import { date, integer, jsonb, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { cardVariant } from "./catalog.js";
import { uuidPk } from "./columns.js";

export const cardInstance = pgTable("card_instance", {
  id: uuidPk(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => cardVariant.id, { onDelete: "restrict" }),
  condition: text("condition"),
  language: text("language"),
  grading: text("grading"),
  ownPrice: numeric("own_price", { precision: 10, scale: 2 }),
  notes: text("notes"),
  acquiredAt: date("acquired_at"),
});

export const artAsset = pgTable("art_asset", {
  id: uuidPk(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  width: integer("width"),
  height: integer("height"),
  source: text("source"),
  license: text("license"),
});

export const goal = pgTable("goal", {
  id: uuidPk(),
  type: text("type").notNull(),
  rules: jsonb("rules").notNull(),
  variantIds: uuid("variant_ids").array().notNull().default([]),
});
