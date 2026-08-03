import { Bot } from "grammy";
import { logger } from "../lib/logger.js";
import {
  handleStart,
  handleRecipe,
  handleSubstitute,
  handleClear,
  handleMessage,
  handleFavorites,
  handleSaveCallback,
  handleViewFavoriteCallback,
  handleDeleteFavoriteCallback,
} from "./handlers.js";

const token = process.env["TELEGRAM_BOT_TOKEN"];
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is required.");
}

export const bot = new Bot(token);

// Commands
bot.command("start", handleStart);
bot.command("recipe", handleRecipe);
bot.command("substitute", handleSubstitute);
bot.command("clear", handleClear);
bot.command("favorites", handleFavorites);

// Callback queries
bot.callbackQuery("save_recipe", handleSaveCallback);
bot.callbackQuery(/^view_fav:/, handleViewFavoriteCallback);
bot.callbackQuery(/^del_fav:/, handleDeleteFavoriteCallback);

// Natural language messages
bot.on("message:text", handleMessage);

// Error handler — log minimal metadata, no user message content
bot.catch((err) => {
  const update = err.ctx?.update;
  logger.error(
    {
      err: err.error,
      updateId: update?.update_id,
      chatId: update?.message?.chat?.id,
      updateType: update ? Object.keys(update).find((k) => k !== "update_id") : undefined,
    },
    "Bot error",
  );
});

export async function startBot(): Promise<void> {
  // Set bot commands menu
  await bot.api.setMyCommands([
    { command: "start",     description: "Начать / справка" },
    { command: "recipe",    description: "Получить рецепт блюда" },
    { command: "substitute", description: "Чем заменить ингредиент" },
    { command: "favorites", description: "Избранные рецепты" },
    { command: "clear",     description: "Очистить историю разговора" },
  ]);

  // Start polling — return a promise that rejects on startup failure
  return new Promise<void>((resolve, reject) => {
    bot
      .start({
        onStart: (botInfo) => {
          logger.info({ username: botInfo.username }, "Telegram bot started");
          resolve();
        },
      })
      .catch(reject);
  });
}
