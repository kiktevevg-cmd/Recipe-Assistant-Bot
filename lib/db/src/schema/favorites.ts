import { pgTable, bigserial, bigint, text, timestamp } from "drizzle-orm/pg-core";

export const favoritesTable = pgTable("favorites", {
  id:        bigserial("id", { mode: "bigint" }).primaryKey(),
  chatId:    bigint("chat_id", { mode: "bigint" }).notNull(),
  title:     text("title").notNull(),
  recipe:    text("recipe").notNull(),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull(),
});

export type Favorite = typeof favoritesTable.$inferSelect;
export type InsertFavorite = typeof favoritesTable.$inferInsert;
