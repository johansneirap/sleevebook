import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { cardVariant } from "./catalog";
import { uuidPk } from "./columns";

// Fase 5 -- N4: where a variant's foil shines. `zones` follows FoilMask in
// @sleevebook/binder-core (normalized rects + inside/outside mode). Variants
// without a row use defaultFoilMask(variant).
export const foilMask = pgTable("foil_mask", {
  variantId: uuid("variant_id")
    .primaryKey()
    .references(() => cardVariant.id, { onDelete: "cascade" }),
  mask: jsonb("mask").notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// One row per camera scan (Claude Vision). Photos are never stored; this is
// for the per-user daily limit and cost tracking.
export const scanLog = pgTable(
  "scan_log",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // "ok" | "no-card" | "error"
    status: text("status").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    // What the model read (name, set, number...), for debugging matches.
    reading: jsonb("reading"),
    matchedVariantId: uuid("matched_variant_id").references(() => cardVariant.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("scan_log_user_created_idx").on(table.userId, table.createdAt)],
);
