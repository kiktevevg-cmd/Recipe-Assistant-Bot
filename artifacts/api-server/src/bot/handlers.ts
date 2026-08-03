import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { chat, buildMessages, addToHistory, clearHistory } from "./index.js";
import { logChat } from "./logger.js";
import { saveFavorite, getFavorites, getFavoriteById, deleteFavoriteById } from "./favorites.js";

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")  // **bold** → bold
    .replace(/\*(.+?)\*/g, "$1")       // *italic* → italic
    .replace(/`(.+?)`/g, "$1");        // `code` → code
}

// Извлекаем заголовок из текста рецепта — первая непустая строка без эмодзи
function extractTitle(text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "Рецепт";
  // Убираем эмодзи и спецсимволы в начале строки
  return firstLine.replace(/^[\p{Emoji}\s🍽️•\-–:]+/u, "").trim() || firstLine;
}

// Хранит последний рецепт для каждого чата (для кнопки "Сохранить")
const lastRecipeMap = new Map<number, { title: string; recipe: string }>();

function saveButton(): InlineKeyboard {
  return new InlineKeyboard().text("💾 Сохранить в избранное", "save_recipe");
}

async function sendTyping(ctx: Context): Promise<void> {
  await ctx.api.sendChatAction(ctx.chat!.id, "typing");
}

export async function handleStart(ctx: Context): Promise<void> {
  const name = ctx.from?.first_name ?? "друг";
  await ctx.reply(
    `👨‍🍳 Привет, ${name}! Я твой помощник по рецептам.\n\n` +
    `Вот что я умею:\n` +
    `🍽️ /recipe <блюдо> — получить рецепт\n` +
    `🔄 /substitute <ингредиент> — чем заменить ингредиент\n` +
    `⭐ /favorites — избранные рецепты\n` +
    `🗑️ /clear — очистить историю разговора\n\n` +
    `Или просто напиши мне: «рецепт борща», «чем заменить яйца», «что приготовить из курицы и риса» — я всё пойму! 😊`,
    { parse_mode: "Markdown" }
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

  const userMessage = `Дай мне рецепт: ${args}`;
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
    await ctx.reply("❌ Ошибка при получении рецепта. Попробуй позже.");
    throw err;
  }
}

export async function handleSubstitute(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const args = ctx.message?.text?.replace(/^\/substitute\s*/i, "").trim();

  if (!args) {
    await ctx.reply("🔄 Укажи ингредиент после команды.\nПример: `/substitute яйца`", { parse_mode: "Markdown" });
    return;
  }

  await sendTyping(ctx);

  const userMessage = `Чем можно заменить: ${args}`;
  const messages = buildMessages(chatId, userMessage);

  try {
    const response = await chat(messages);
    addToHistory(chatId, "user", userMessage);
    addToHistory(chatId, "assistant", response);

    const cleaned = stripMarkdown(response);
    await Promise.all([
      ctx.reply(cleaned),
      logChat({ chatId, username: ctx.from?.username, firstName: ctx.from?.first_name, userMessage, botResponse: response }),
    ]);
  } catch (err) {
    await ctx.reply("❌ Ошибка. Попробуй позже.");
    throw err;
  }
}

export async function handleClear(ctx: Context): Promise<void> {
  clearHistory(ctx.chat!.id);
  await ctx.reply("🗑️ История разговора очищена. Начинаем с чистого листа!");
}

// Определяем тип запроса по ключевым словам
function detectIntent(text: string): "recipe" | "substitute" | "general" {
  const lower = text.toLowerCase();

  const substituteKeywords = ["заменить", "замена", "вместо", "альтернатива", "чем заменить", "substitute"];
  if (substituteKeywords.some((k) => lower.includes(k))) return "substitute";

  const recipeKeywords = ["рецепт", "приготовить", "готовить", "сделать", "испечь", "сварить", "пожарить", "recipe", "как делать"];
  if (recipeKeywords.some((k) => lower.includes(k))) return "recipe";

  return "general";
}

export async function handleMessage(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const text = ctx.message?.text;

  if (!text) return;

  await sendTyping(ctx);

  const intent = detectIntent(text);
  let userMessage = text;

  if (intent === "recipe") {
    userMessage = `Дай рецепт для: ${text}`;
  } else if (intent === "substitute") {
    userMessage = `Помоги с заменой ингредиента: ${text}`;
  }

  const messages = buildMessages(chatId, userMessage);

  try {
    const response = await chat(messages);
    addToHistory(chatId, "user", text);
    addToHistory(chatId, "assistant", response);

    const cleaned = stripMarkdown(response);

    // Показываем кнопку сохранения только для рецептов
    if (intent === "recipe") {
      lastRecipeMap.set(chatId, { title: extractTitle(cleaned), recipe: cleaned });
      await Promise.all([
        ctx.reply(cleaned, { reply_markup: saveButton() }),
        logChat({ chatId, username: ctx.from?.username, firstName: ctx.from?.first_name, userMessage: text, botResponse: response }),
      ]);
    } else {
      await Promise.all([
        ctx.reply(cleaned),
        logChat({ chatId, username: ctx.from?.username, firstName: ctx.from?.first_name, userMessage: text, botResponse: response }),
      ]);
    }
  } catch (err) {
    await ctx.reply("❌ Что-то пошло не так. Попробуй ещё раз!");
    throw err;
  }
}

// ── Избранное ──────────────────────────────────────────────────────────────

export async function handleFavorites(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;

  try {
    const items = await getFavorites(chatId);

    if (items.length === 0) {
      await ctx.reply("⭐ У тебя пока нет сохранённых рецептов.\n\nПолучи рецепт и нажми «💾 Сохранить в избранное».");
      return;
    }

    const keyboard = new InlineKeyboard();
    for (const item of items) {
      keyboard.text(item.title, `view_fav:${item.id}`).row();
    }

    await ctx.reply("⭐ Твои избранные рецепты:", { reply_markup: keyboard });
  } catch (err) {
    await ctx.reply("❌ Не удалось загрузить избранное. Попробуй позже.");
    throw err;
  }
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
    await ctx.reply("🗑️ Рецепт удалён из избранного.");
  } catch (err) {
    await ctx.reply("❌ Не удалось удалить. Попробуй позже.");
    throw err;
  }
}
