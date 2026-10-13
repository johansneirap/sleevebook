import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
