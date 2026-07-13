import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;

export function getPostgresUrl() {
  const connectionString = process.env.POSTGRES_URL?.trim();
  if (!connectionString) {
    throw new Error("POSTGRES_URL must be configured on the server.");
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("POSTGRES_URL must be a valid PostgreSQL connection URL.");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("POSTGRES_URL must use the postgres or postgresql protocol.");
  }
  const isLocalhost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";
  if (process.env.NODE_ENV === "production" && isLocalhost) {
    throw new Error("POSTGRES_URL cannot point to localhost in production.");
  }
  return connectionString;
}

export function getDb() {
  const connectionString = getPostgresUrl();
  client ??= postgres(connectionString, { prepare: false, max: 1 });
  return drizzle(client, { schema });
}
