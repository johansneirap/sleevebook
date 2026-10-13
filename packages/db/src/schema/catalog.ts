import { desc } from "drizzle-orm";
import {
  boolean,
  date,
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
import { uuidPk } from "./columns";

export const game = pgTable("game", {
  id: uuidPk(),
  name: text("name").notNull().unique(),
});

export const set = pgTable("set", {
  id: uuidPk(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => game.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  era: text("era"),
  releasedAt: date("released_at"),
  printedTotal: integer("printed_total"),
  ptcgoCode: text("ptcgo_code"),
  language: text("language").notNull().default("en"),
});

export const card = pgTable(
  "card",
  {
    id: uuidPk(),
    setId: uuid("set_id")
      .notNull()
      .references(() => set.id, { onDelete: "restrict" }),
    number: text("number").notNull(),
    name: text("name").notNull(),
    species: text("species").array(),
    supertype: text("supertype").notNull(),
    types: text("types").array(),
    rarity: text("rarity"),
    illustrator: text("illustrator"),
    language: text("language").notNull().default("en"),
  },
  (table) => [index("card_set_id_number_idx").on(table.setId, table.number)],
);

export const cardVariant = pgTable(
  "card_variant",
  {
    id: uuidPk(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "restrict" }),
    variant: text("variant").notNull(),
    renderEffect: text("render_effect"),
    images: jsonb("images"),
    needsReview: boolean("needs_review").notNull().default(false),
  },
  (table) => [index("card_variant_card_id_variant_idx").on(table.cardId, table.variant)],
);

export const externalId = pgTable(
  "external_id",
  {
    id: uuidPk(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
  },
  (table) => [
    uniqueIndex("external_id_provider_external_id_idx").on(table.provider, table.externalId),
  ],
);

export const pricePoint = pgTable(
  "price_point",
  {
    id: uuidPk(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => cardVariant.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    condition: text("condition"),
    grading: text("grading"),
    currency: text("currency").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    capturedAt: timestamp("captured_at").notNull().defaultNow(),
  },
  (table) => [
    index("price_point_variant_source_captured_idx").on(
      table.variantId,
      table.source,
      desc(table.capturedAt),
    ),
  ],
);
