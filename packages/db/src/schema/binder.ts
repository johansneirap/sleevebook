import {
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
import { goal } from "./collection";
import { uuidPk } from "./columns";

export const binder = pgTable("binder", {
  id: uuidPk(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  formatRows: integer("format_rows").notNull(),
  formatCols: integer("format_cols").notNull(),
  opening: text("opening").notNull().default("side"),
  loading: text("loading").notNull().default("side"),
  sheets: integer("sheets").notNull(),
  theme: jsonb("theme"),
  goalId: uuid("goal_id").references(() => goal.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"),
  // Fase 3: "collection" (default) or "seller" -- seller mode shows prices,
  // listing states and contact buttons on the public page.
  mode: text("mode").notNull().default("collection"),
  // { whatsapp?: string; instagram?: string; email?: string } -- see
  // sellerContactSchema in @sleevebook/binder-core.
  sellerContact: jsonb("seller_contact"),
  // Display currency for this binder's prices: "usd" | "clp" | "eur".
  currency: text("currency").notNull().default("usd"),
  // Fase 4: set by an admin (OWNER_EMAIL) to pin the binder in /galeria.
  featuredAt: timestamp("featured_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const binderVersion = pgTable("binder_version", {
  id: uuidPk(),
  binderId: uuid("binder_id")
    .notNull()
    .references(() => binder.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  layout: jsonb("layout").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
});

export const shareLink = pgTable(
  "share_link",
  {
    id: uuidPk(),
    binderId: uuid("binder_id")
      .notNull()
      .references(() => binder.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    visibility: text("visibility").notNull().default("unlisted"),
    views: integer("views").notNull().default(0),
  },
  (table) => [uniqueIndex("share_link_slug_idx").on(table.slug)],
);

// Seller-mode state per pocket. Lives outside binder_version on purpose:
// marking a card sold or changing its price must show on the public link
// immediately, without republishing the binder.
export const pocketListing = pgTable(
  "pocket_listing",
  {
    id: uuidPk(),
    binderId: uuid("binder_id")
      .notNull()
      .references(() => binder.id, { onDelete: "cascade" }),
    pocketCode: text("pocket_code").notNull(),
    // "disponible" | "reservado" | "vendido"
    status: text("status").notNull().default("disponible"),
    // Seller's asking price, in `currency`. Null = fall back to the market price.
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: text("currency").notNull().default("usd"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("pocket_listing_binder_pocket_idx").on(table.binderId, table.pocketCode)],
);
