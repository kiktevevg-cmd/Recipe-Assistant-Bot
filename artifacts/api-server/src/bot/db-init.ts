import { pool } from "@workspace/db";

export async function initDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_log (
      id           BIGSERIAL PRIMARY KEY,
      chat_id      BIGINT NOT NULL,
      username     TEXT,
      first_name   TEXT,
      user_message TEXT NOT NULL,
      bot_response TEXT NOT NULL,
      created_at   TIMESTAMP NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      id         BIGSERIAL PRIMARY KEY,
      chat_id    BIGINT NOT NULL,
      title      TEXT NOT NULL,
      recipe     TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL
    )
  `);
}
