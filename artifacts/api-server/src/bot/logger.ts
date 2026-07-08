import { db, chatLogTable } from "@workspace/db";

export async function logChat(params: {
  chatId: number | bigint;
  username?: string;
  firstName?: string;
  userMessage: string;
  botResponse: string;
}): Promise<void> {
  try {
    await db.insert(chatLogTable).values({
      chatId:      BigInt(params.chatId),
      username:    params.username ?? null,
      firstName:   params.firstName ?? null,
      userMessage: params.userMessage,
      botResponse: params.botResponse,
    });
  } catch (err) {
    // Логирование не должно ронять бота — только пишем в консоль
    console.error("[chat-log] Failed to write log entry:", (err as Error).message);
  }
}
