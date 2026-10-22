import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { cardVariant } from "./catalog";
import { uuidPk } from "./columns";

// One physical copy the user owns (Fase 7). A binder pocket may point at one
// copy through `instance` in its layout; a copy sits in at most one pocket.
// Copies in no pocket are the user's "repetidas" / loose stock.
export const cardInstance = pgTable(
  "card_instance",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => cardVariant.id, { onDelete: "restrict" }),
    // COPY_LANGUAGES code ("en", "es", "ja", ...). The catalog image stays EN.
    language: text("language").notNull().default("en"),
    // COPY_CONDITIONS code ("NM", "LP", "MP", "HP", "DMG").
    condition: text("condition").notNull().default("NM"),
    gradingCompany: text("grading_company"),
    gradingGrade: numeric("grading_grade", { precision: 3, scale: 1 }),
    // What the owner paid, in `purchaseCurrency` (informational).
    purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
    purchaseCurrency: text("purchase_currency").notNull().default("usd"),
    // Owner's own valuation in USD; beats the condition-based estimate.
    valueUsd: numeric("value_usd", { precision: 12, scale: 2 }),
    notes: text("notes"),
    acquiredAt: date("acquired_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("card_instance_user_variant_idx").on(table.userId, table.variantId)],
);

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
