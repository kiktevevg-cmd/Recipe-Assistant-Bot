import { db, chatLogTable, isDbAvailable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { Message } from "./openai.js";

const SYSTEM_PROMPT = `Ты — дружелюбный кулинарный помощник, который говорит на русском языке.
Ты помогаешь пользователям с рецептами, заменой ингредиентов и кулинарными советами.

Важно: не используй символы * и ** для форматирования. Не используй markdown-разметку вообще.

При генерации рецептов используй следующий формат:
🍽️ Название блюда

Ингредиенты:
• ингредиент 1 — количество
• ингредиент 2 — количество

Приготовление:
1. Шаг первый
2. Шаг второй
...

Время: X минут | Порции: X

При замене ингредиентов давай 2-3 варианта с пояснением, как это повлияет на вкус.
Отвечай кратко, по делу и с теплотой. Используй эмодзи умеренно.`;

const MAX_HISTORY_MESSAGES = 10; // пар user+assistant
const MAX_CHATS = 5000;          // максимум активных чатов в памяти
const CHAT_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа без активности — выселяем

type ChatEntry = {
  messages: Message[];
  lastActiveAt: number;
};

const conversations = new Map<number, ChatEntry>();

function evictStaleChats(): void {
  const now = Date.now();
  for (const [chatId, entry] of conversations) {
    if (now - entry.lastActiveAt > CHAT_TTL_MS) {
      conversations.delete(chatId);
    }
  }
}

function ensureCapacity(): void {
  if (conversations.size < MAX_CHATS) return;

  // Выселяем самый давно активный чат
  let oldestId: number | null = null;
  let oldestTime = Infinity;
  for (const [chatId, entry] of conversations) {
    if (entry.lastActiveAt < oldestTime) {
      oldestTime = entry.lastActiveAt;
      oldestId = chatId;
    }
  }
  if (oldestId !== null) conversations.delete(oldestId);
}

function getOrCreateEntry(chatId: number): ChatEntry {
  let entry = conversations.get(chatId);
  if (!entry) {
    ensureCapacity();
    entry = { messages: [], lastActiveAt: Date.now() };
    conversations.set(chatId, entry);
  }
  return entry;
}

export function addToHistory(chatId: number, role: "user" | "assistant", content: string): void {
  // Периодически чистим устаревшие чаты (раз на 100 вызовов)
  if (Math.random() < 0.01) evictStaleChats();

  const entry = getOrCreateEntry(chatId);
  entry.messages.push({ role, content });
  entry.lastActiveAt = Date.now();

  // Обрезаем до MAX_HISTORY_MESSAGES пар (user + assistant)
  const maxMsgs = MAX_HISTORY_MESSAGES * 2;
  if (entry.messages.length > maxMsgs) {
    entry.messages.splice(0, entry.messages.length - maxMsgs);
  }
}

export async function clearHistory(chatId: number): Promise<void> {
  conversations.delete(chatId);
  if (!isDbAvailable) return;
  try {
    await db.delete(chatLogTable).where(eq(chatLogTable.chatId, BigInt(chatId)));
  } catch (err) {
    console.error("[context] Failed to clear persisted history:", (err as Error).message);
  }
}

/**
 * Загружает историю из chat_log в память, если чата ещё нет в Map
 * (например, после перезапуска сервера).
 */
async function hydrateFromDb(chatId: number): Promise<void> {
  if (conversations.has(chatId)) return;
  if (!isDbAvailable) return;

  try {
    const rows = await db
      .select({ userMessage: chatLogTable.userMessage, botResponse: chatLogTable.botResponse })
      .from(chatLogTable)
      .where(eq(chatLogTable.chatId, BigInt(chatId)))
      .orderBy(desc(chatLogTable.id))
      .limit(MAX_HISTORY_MESSAGES);

    if (rows.length === 0) return;

    const messages: Message[] = [];
    for (const row of rows.reverse()) {
      messages.push({ role: "user", content: row.userMessage });
      messages.push({ role: "assistant", content: row.botResponse });
    }

    ensureCapacity();
    conversations.set(chatId, { messages, lastActiveAt: Date.now() });
  } catch (err) {
    // Ошибка чтения истории не должна ронять бота — просто работаем без контекста
    console.error("[context] Failed to load history from DB:", (err as Error).message);
  }
}

export async function buildMessages(chatId: number, userMessage: string): Promise<Message[]> {
  await hydrateFromDb(chatId);
  const entry = conversations.get(chatId);
  const history = entry?.messages ?? [];
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage },
  ];
}
