import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { cardVariant } from "./catalog";
import { uuidPk } from "./columns";

// Fase 4 -- comunidad. One row per user with their public-facing settings,
// kept apart from Better Auth's `user` table.
export const profile = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  bio: text("bio"),
  // { whatsapp?, instagram?, email? } -- same shape as sellerContactSchema.
  contact: jsonb("contact"),
  // /u/[handle] is visible to anyone when true.
  isPublic: boolean("is_public").notNull().default(true),
  // The wishlist shows on the public profile when true.
  wishlistPublic: boolean("wishlist_public").notNull().default(true),
  // Takes part in trade matching (both directions) when true.
  tradesOptIn: boolean("trades_opt_in").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const wishlistItem = pgTable(
  "wishlist_item",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => cardVariant.id, { onDelete: "cascade" }),
    // Price alert: notify when the market price drops to/below this (USD).
    targetPriceUsd: numeric("target_price_usd", { precision: 10, scale: 2 }),
    note: text("note"),
    // Set when a price alert fired; cleared when the price goes back above
    // the target, so each crossing notifies once.
    alertedAt: timestamp("alerted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("wishlist_item_user_variant_idx").on(table.userId, table.variantId)],
);

// In-app inbox ("Avisos"). Written by jobs (prices, catalog ingest) and the app.
export const notification = pgTable(
  "notification",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // "precio" | "set-nuevo" | "intercambio"
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    data: jsonb("data"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    readAt: timestamp("read_at"),
  },
  (table) => [index("notification_user_created_idx").on(table.userId, table.createdAt)],
);

// Species a user follows for "set nuevo" alerts, on top of the species of
// the master-set goals of their binders (goal.rules.species).
export const speciesFollow = pgTable(
  "species_follow",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    species: text("species").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("species_follow_user_species_idx").on(table.userId, table.species)],
);

// Shareable binder designs: structure and look, never cards.
export const binderTemplate = pgTable("binder_template", {
  id: uuidPk(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  formatRows: integer("format_rows").notNull(),
  formatCols: integer("format_cols").notNull(),
  opening: text("opening").notNull().default("side"),
  sheets: integer("sheets").notNull(),
  // Layout fragments: theme, panels (art), sections -- see layoutSchema.
  theme: jsonb("theme").notNull(),
  panels: jsonb("panels").notNull().default([]),
  sections: jsonb("sections").notNull().default([]),
  // "public" | "private"
  visibility: text("visibility").notNull().default("private"),
  usesCount: integer("uses_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
