import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const requiredWasteReportColumns = [
  "id",
  "owner_email",
  "site_name",
  "ward",
  "latitude",
  "longitude",
  "camera_height_m",
  "horizontal_fov_deg",
  "image_object_key",
  "analysis_id",
  "analysis_mode",
  "model_version",
  "dominant_material",
  "confidence",
  "manual_review_required",
  "total_area_m2",
  "total_volume_m3",
  "total_mass_kg",
  "total_co2_kg",
  "status",
  "created_at",
  "updated_at",
];

function postgresUrl() {
  const value = process.env.POSTGRES_URL?.trim();
  if (!value) throw new Error("POSTGRES_URL must be configured before running migrations.");
  const parsed = new URL(value);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("POSTGRES_URL must use the postgres or postgresql protocol.");
  }
  if (
    process.env.NODE_ENV === "production" &&
    ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)
  ) {
    throw new Error("POSTGRES_URL cannot point to localhost in production.");
  }
  return { value, parsed };
}

const { value: connectionString, parsed } = postgresUrl();
const client = postgres(connectionString, { max: 1, prepare: false });
const database = drizzle(client);
const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

try {
  console.log(`[db:migrate] Applying migrations to ${parsed.hostname}/${parsed.pathname.slice(1)}.`);
  await migrate(database, { migrationsFolder });

  const rows = await client`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'waste_reports'
  `;
  const actualColumns = new Set(rows.map((row) => row.column_name));
  const missingColumns = requiredWasteReportColumns.filter((column) => !actualColumns.has(column));
  if (rows.length === 0) {
    throw new Error('Migration verification failed: public.waste_reports does not exist.');
  }
  if (missingColumns.length > 0) {
    throw new Error(`Migration verification failed: waste_reports is missing ${missingColumns.join(", ")}.`);
  }

  const migrationSql = await readFile(path.join(migrationsFolder, "0000_marvelous_veda.sql"), "utf8");
  for (const column of requiredWasteReportColumns) {
    if (!migrationSql.includes(`"${column}"`)) {
      throw new Error(`Migration file verification failed: ${column} is not declared.`);
    }
  }
  console.log(`[db:migrate] Verified public.waste_reports with ${requiredWasteReportColumns.length} required columns.`);
} catch (error) {
  const diagnostic = error && typeof error === "object" ? error : {};
  console.error("[db:migrate] Migration failed", {
    message: error instanceof Error ? error.message : String(error),
    sqlState: "code" in diagnostic ? diagnostic.code : null,
  });
  process.exitCode = 1;
} finally {
  await client.end();
}
