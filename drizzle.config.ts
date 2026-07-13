import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.POSTGRES_URL?.trim();
if (!databaseUrl) {
  throw new Error("POSTGRES_URL must be configured for Drizzle commands.");
}

const parsedDatabaseUrl = new URL(databaseUrl);
if (
  process.env.NODE_ENV === "production" &&
  ["localhost", "127.0.0.1", "::1"].includes(parsedDatabaseUrl.hostname)
) {
  throw new Error("POSTGRES_URL cannot point to localhost in production.");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
