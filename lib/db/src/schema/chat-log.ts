import { pgTable, bigserial, bigint, text, timestamp } from "drizzle-orm/pg-core";

export const chatLogTable = pgTable("chat_log", {
  id:           bigserial("id", { mode: "bigint" }).primaryKey(),
  chatId:       bigint("chat_id", { mode: "bigint" }).notNull(),
  username:     text("username"),
  firstName:    text("first_name"),
  userMessage:  text("user_message").notNull(),
  botResponse:  text("bot_response").notNull(),
  createdAt:    timestamp("created_at", { withTimezone: false }).notNull(),
});

export type ChatLog = typeof chatLogTable.$inferSelect;
export type InsertChatLog = typeof chatLogTable.$inferInsert;
