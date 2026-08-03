import type { Context } from "grammy";
import { InlineKeyboard, Keyboard } from "grammy";
import { chat, buildMessages, addToHistory, clearHistory } from "./index.js";
import { logChat } from "./logger.js";
import { saveFavorite, getFavorites, getFavoriteById, deleteFavoriteById } from "./favorites.js";

// ── Вспомогательные функции ────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

function extractTitle(text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "Рецепт";
  return firstLine.replace(/^[\p{Emoji}\s🍽️•\-–:]+/u, "").trim() || firstLine;
}

async function sendTyping(ctx: Context): Promise<void> {
  await ctx.api.sendChatAction(ctx.chat!.id, "typing");
}

// ── Клавиатура меню ────────────────────────────────────────────────────────

export const BUTTON = {
  RECIPE:     "🍽️ Рецепт",
  SUBSTITUTE: "🔄 Замена ингредиента",
  FAVORITES:  "⭐ Избранное",
  CLEAR:      "🗑️ Очистить историю",
} as const;

export const mainKeyboard = new Keyboard()
  .text(BUTTON.RECIPE).text(BUTTON.SUBSTITUTE).row()
  .text(BUTTON.FAVORITES).text(BUTTON.CLEAR)
  .resized()
  .persistent();

function saveButton(): InlineKeyboard {
  return new InlineKeyboard().text("💾 Сохранить в избранное", "save_recipe");
}

// ── Состояние ожидания ввода ───────────────────────────────────────────────

type WaitState = "recipe" | "substitute";
const waitMap = new Map<number, WaitState>();

// ── Последний рецепт (для кнопки сохранения) ──────────────────────────────

const lastRecipeMap = new Map<number, { title: string; recipe: string }>();

// ── Handlers ───────────────────────────────────────────────────────────────

export async function handleStart(ctx: Context): Promise<void> {
  const name = ctx.from?.first_name ?? "друг";
  await ctx.reply(
    `👨‍🍳 Привет, ${name}! Я твой помощник по рецептам.\n\n` +
    `Используй кнопки меню или напиши мне напрямую — я всё пойму! 😊`,
    { reply_markup: mainKeyboard }
  );
}

export async function handleRecipe(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const args = ctx.message?.text?.replace(/^\/recipe\s*/i, "").trim();

  if (!args) {
    await ctx.reply("🍽️ Укажи название блюда после команды.\nПример: `/recipe борщ`", { parse_mode: "Markdown" });
    return;
  }

  await sendTyping(ctx);
  await processRecipe(ctx, chatId, args);
}

export async function handleSubstitute(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const args = ctx.message?.text?.replace(/^\/substitute\s*/i, "").trim();

  if (!args) {
    await ctx.reply("🔄 Укажи ингредиент после команды.\nПример: `/substitute яйца`", { parse_mode: "Markdown" });
    return;
  }

  await sendTyping(ctx);
  await processSubstitute(ctx, chatId, args);
}

export async function handleClear(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  clearHistory(chatId);
  waitMap.delete(chatId);
  await ctx.reply("🗑️ История разговора очищена. Начинаем с чистого листа!", { reply_markup: mainKeyboard });
}

export async function handleMessage(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const text = ctx.message?.text;
  if (!text) return;

  // ── Нажатия кнопок меню ──
  if (text === BUTTON.RECIPE) {
    waitMap.set(chatId, "recipe");
    await ctx.reply("🍽️ Какое блюдо приготовить?", { reply_markup: mainKeyboard });
    return;
  }
  if (text === BUTTON.SUBSTITUTE) {
    waitMap.set(chatId, "substitute");
    await ctx.reply("🔄 Что нужно заменить?", { reply_markup: mainKeyboard });
    return;
  }
  if (text === BUTTON.FAVORITES) {
    await showFavorites(ctx, chatId);
    return;
  }
  if (text === BUTTON.CLEAR) {
    clearHistory(chatId);
    waitMap.delete(chatId);
    await ctx.reply("🗑️ История разговора очищена. Начинаем с чистого листа!", { reply_markup: mainKeyboard });
    return;
  }

  // ── Ожидаем ввод после нажатия кнопки ──
  const waitState = waitMap.get(chatId);
  if (waitState === "recipe") {
    waitMap.delete(chatId);
    await sendTyping(ctx);
    await processRecipe(ctx, chatId, text);
    return;
  }
  if (waitState === "substitute") {
    waitMap.delete(chatId);
    await sendTyping(ctx);
    await processSubstitute(ctx, chatId, text);
    return;
  }

  // ── Свободный ввод — определяем намерение ──
  await sendTyping(ctx);
  const intent = detectIntent(text);

  if (intent === "recipe") {
    await processRecipe(ctx, chatId, text);
  } else if (intent === "substitute") {
    await processSubstitute(ctx, chatId, text);
  } else {
    await processGeneral(ctx, chatId, text);
  }
}

// ── Логика обработки запросов ──────────────────────────────────────────────

async function processRecipe(ctx: Context, chatId: number, query: string): Promise<void> {
  const userMessage = `Дай мне рецепт: ${query}`;
  const messages = buildMessages(chatId, userMessage);

  try {
    const response = await chat(messages);
    addToHistory(chatId, "user", userMessage);
    addToHistory(chatId, "assistant", response);

    const cleaned = stripMarkdown(response);
    lastRecipeMap.set(chatId, { title: extractTitle(cleaned), recipe: cleaned });

    await Promise.all([
      ctx.reply(cleaned, { reply_markup: saveButton() }),
      logChat({ chatId, username: ctx.from?.username, firstName: ctx.from?.first_name, userMessage, botResponse: response }),
    ]);
  } catch (err) {
    await ctx.reply("❌ Ошибка при получении рецепта. Попробуй позже.", { reply_markup: mainKeyboard });
    throw err;
  }
}

async function processSubstitute(ctx: Context, chatId: number, query: string): Promise<void> {
  const userMessage = `Чем можно заменить: ${query}`;
  const messages = buildMessages(chatId, userMessage);

  try {
    const response = await chat(messages);
    addToHistory(chatId, "user", userMessage);
    addToHistory(chatId, "assistant", response);

    const cleaned = stripMarkdown(response);
    await Promise.all([
      ctx.reply(cleaned, { reply_markup: mainKeyboard }),
      logChat({ chatId, username: ctx.from?.username, firstName: ctx.from?.first_name, userMessage, botResponse: response }),
    ]);
  } catch (err) {
    await ctx.reply("❌ Ошибка. Попробуй позже.", { reply_markup: mainKeyboard });
    throw err;
  }
}

async function processGeneral(ctx: Context, chatId: number, text: string): Promise<void> {
  const messages = buildMessages(chatId, text);

  try {
    const response = await chat(messages);
    addToHistory(chatId, "user", text);
    addToHistory(chatId, "assistant", response);

    const cleaned = stripMarkdown(response);
    await Promise.all([
      ctx.reply(cleaned, { reply_markup: mainKeyboard }),
      logChat({ chatId, username: ctx.from?.username, firstName: ctx.from?.first_name, userMessage: text, botResponse: response }),
    ]);
  } catch (err) {
    await ctx.reply("❌ Что-то пошло не так. Попробуй ещё раз!", { reply_markup: mainKeyboard });
    throw err;
  }
}

function detectIntent(text: string): "recipe" | "substitute" | "general" {
  const lower = text.toLowerCase();
  const substituteKeywords = ["заменить", "замена", "вместо", "альтернатива", "чем заменить", "substitute"];
  if (substituteKeywords.some((k) => lower.includes(k))) return "substitute";
  const recipeKeywords = ["рецепт", "приготовить", "готовить", "сделать", "испечь", "сварить", "пожарить", "recipe", "как делать"];
  if (recipeKeywords.some((k) => lower.includes(k))) return "recipe";
  return "general";
}

// ── Избранное ──────────────────────────────────────────────────────────────

async function showFavorites(ctx: Context, chatId: number): Promise<void> {
  try {
    const items = await getFavorites(chatId);

    if (items.length === 0) {
      await ctx.reply(
        "⭐ У тебя пока нет сохранённых рецептов.\n\nПолучи рецепт и нажми «💾 Сохранить в избранное».",
        { reply_markup: mainKeyboard }
      );
      return;
    }

    const keyboard = new InlineKeyboard();
    for (const item of items) {
      keyboard.text(item.title, `view_fav:${item.id}`).row();
    }

    await ctx.reply("⭐ Твои избранные рецепты:", { reply_markup: keyboard });
  } catch (err) {
    await ctx.reply("❌ Не удалось загрузить избранное. Попробуй позже.", { reply_markup: mainKeyboard });
    throw err;
  }
}

export async function handleFavorites(ctx: Context): Promise<void> {
  await showFavorites(ctx, ctx.chat!.id);
}

export async function handleSaveCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const last = lastRecipeMap.get(chatId);

  await ctx.answerCallbackQuery();

  if (!last) {
    await ctx.reply("⚠️ Нет рецепта для сохранения. Сначала запроси рецепт.");
    return;
  }

  try {
    await saveFavorite(chatId, last.title, last.recipe);
    lastRecipeMap.delete(chatId);
    await ctx.reply(`✅ Рецепт сохранён в избранное!\n\n📌 ${last.title}`);
  } catch (err) {
    await ctx.reply("❌ Не удалось сохранить. Попробуй позже.");
    throw err;
  }
}

export async function handleViewFavoriteCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  const idStr = data.replace("view_fav:", "");

  await ctx.answerCallbackQuery();

  try {
    const item = await getFavoriteById(BigInt(idStr));
    if (!item) {
      await ctx.reply("⚠️ Рецепт не найден.");
      return;
    }

    const keyboard = new InlineKeyboard().text("🗑️ Удалить из избранного", `del_fav:${idStr}`);
    await ctx.reply(`⭐ ${item.title}\n\n${item.recipe}`, { reply_markup: keyboard });
  } catch (err) {
    await ctx.reply("❌ Не удалось загрузить рецепт. Попробуй позже.");
    throw err;
  }
}

export async function handleDeleteFavoriteCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  const idStr = data.replace("del_fav:", "");

  await ctx.answerCallbackQuery();

  try {
    await deleteFavoriteById(BigInt(idStr));
    await ctx.reply("🗑️ Рецепт удалён из избранного.", { reply_markup: mainKeyboard });
  } catch (err) {
    await ctx.reply("❌ Не удалось удалить. Попробуй позже.");
    throw err;
  }
}
