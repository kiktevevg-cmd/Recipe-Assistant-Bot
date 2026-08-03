import { db, favoritesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

export async function saveFavorite(chatId: number, title: string, recipe: string): Promise<void> {
  const moscowTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
  await db.insert(favoritesTable).values({
    chatId:    BigInt(chatId),
    title,
    recipe,
    createdAt: moscowTime,
  });
}

export async function getFavorites(chatId: number): Promise<Array<{ id: bigint; title: string }>> {
  return db
    .select({ id: favoritesTable.id, title: favoritesTable.title })
    .from(favoritesTable)
    .where(eq(favoritesTable.chatId, BigInt(chatId)))
    .orderBy(desc(favoritesTable.createdAt))
    .limit(20);
}

export async function getFavoriteById(id: bigint): Promise<{ title: string; recipe: string } | null> {
  const rows = await db
    .select({ title: favoritesTable.title, recipe: favoritesTable.recipe })
    .from(favoritesTable)
    .where(eq(favoritesTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteFavoriteById(id: bigint): Promise<void> {
  await db.delete(favoritesTable).where(eq(favoritesTable.id, id));
}
