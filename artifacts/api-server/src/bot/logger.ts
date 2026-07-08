import { db, chatLogTable } from "@workspace/db";

export async function logChat(params: {
  chatId: number | bigint;
  username?: string;
  firstName?: string;
  userMessage: string;
  botResponse: string;
}): Promise<void> {
  try {
    // Московское время UTC+3
    const moscowTime = new Date(Date.now() + 3 * 60 * 60 * 1000);

    await db.insert(chatLogTable).values({
      chatId:      BigInt(params.chatId),
      username:    params.username ?? null,
      firstName:   params.firstName ?? null,
      userMessage: params.userMessage,
      botResponse: params.botResponse,
      createdAt:   moscowTime,
    });
  } catch (err) {
    // Логирование не должно ронять бота — только пишем в консоль
    console.error("[chat-log] Failed to write log entry:", (err as Error).message);
  }
}
