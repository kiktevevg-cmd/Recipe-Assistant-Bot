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

export function clearHistory(chatId: number): void {
  conversations.delete(chatId);
}

export function buildMessages(chatId: number, userMessage: string): Message[] {
  const entry = conversations.get(chatId);
  const history = entry?.messages ?? [];
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage },
  ];
}
