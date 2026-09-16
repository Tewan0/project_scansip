import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });
config({ path: ".env.local" });

// Supabase Transaction Pooler (port 6543) does not support concurrent DDL/schema introspection on a single connection.
// For Drizzle Kit CLI migrations/push, switch to session pooler (port 5432).
const connectionUrl = (process.env.DATABASE_URL || "").replace(":6543/", ":5432/");

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    url: connectionUrl,
  },
});
