import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

/** true, если DATABASE_URL задан и база доступна для использования */
export const isDbAvailable = Boolean(connectionString);

function unavailable(): never {
  throw new Error("DATABASE_URL is not set — database features are disabled");
}

export const pool: InstanceType<typeof Pool> = connectionString
  ? new Pool({ connectionString })
  : (new Proxy({}, { get: unavailable }) as InstanceType<typeof Pool>);

export const db: ReturnType<typeof drizzle<typeof schema>> = connectionString
  ? drizzle(pool, { schema })
  : (new Proxy({}, { get: unavailable }) as ReturnType<typeof drizzle<typeof schema>>);

export * from "./schema";
