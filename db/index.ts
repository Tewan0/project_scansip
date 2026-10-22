import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Connection string for Supabase PostgreSQL
const connectionString = process.env.DATABASE_URL || "";

// In Next.js development (HMR), prevent creating new connection pools on each reload
const globalForDb = globalThis as unknown as {
  conn?: postgres.Sql;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

const client =
  globalForDb.conn ??
  postgres(connectionString, {
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.conn = client;
}

export const db = globalForDb.db ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
export * from "./schema";
