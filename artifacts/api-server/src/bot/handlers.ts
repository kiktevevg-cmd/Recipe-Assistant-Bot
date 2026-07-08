import type { Context } from "grammy";
import { chat, buildMessages, addToHistory, clearHistory } from "./index.js";
import { logChat } from "./logger.js";

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")  // **bold** → bold
    .replace(/\*(.+?)\*/g, "$1")       // *italic* → italic
    .replace(/`(.+?)`/g, "$1");        // `code` → code
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
    await Promise.all([
      ctx.reply(stripMarkdown(response)),
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
    await Promise.all([
      ctx.reply(stripMarkdown(response)),
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
    await Promise.all([
      ctx.reply(stripMarkdown(response)),
      logChat({ chatId, username: ctx.from?.username, firstName: ctx.from?.first_name, userMessage: text, botResponse: response }),
    ]);
  } catch (err) {
    await ctx.reply("❌ Что-то пошло не так. Попробуй ещё раз!");
    throw err;
  }
}
