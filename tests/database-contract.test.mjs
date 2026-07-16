import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const requiredColumns = [
  "id", "owner_email", "site_name", "ward", "latitude", "longitude",
  "camera_height_m", "horizontal_fov_deg", "image_object_key", "analysis_id",
  "analysis_mode", "model_version", "dominant_material", "confidence",
  "manual_review_required", "total_area_m2", "total_volume_m3", "total_mass_kg",
  "total_co2_kg", "status", "created_at", "updated_at",
];

async function loadReportsRoute() {
  let source = await read("app/api/reports/route.ts");
  const replacements = [
    ['import { desc, eq } from "drizzle-orm";', "const desc = (value) => value; const eq = () => true;"],
    ['import { getDb } from "../../../db";', "const getDb = () => globalThis.__testReportsDb;"],
    [
      'import { materialEstimates, statusEvents, wasteReports } from "../../../db/schema";',
      'const materialEstimates = Symbol("materialEstimates"); const statusEvents = Symbol("statusEvents"); const wasteReports = Symbol("wasteReports");',
    ],
    [
      'import { requireRole } from "../../auth/server";',
      'const requireRole = async () => ({ ok: true, session: { mobile: "9876543210" } });',
    ],
  ];
  for (const [from, to] of replacements) source = source.replace(from, to);
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

function reportRequest() {
  return new Request("https://example.onrender.com/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      siteName: "Render smoke test",
      ward: "Lashkar",
      cameraHeightM: 3,
      horizontalFovDeg: 60,
      imageObjectKey: null,
      analysis: {
        analysisId: "PROTO-TEST",
        mode: "prototype",
        dominantMaterial: "Concrete",
        confidence: 0.82,
        manualReviewRequired: false,
        totalAreaM2: 2,
        totalVolumeM3: 1,
        totalMassKg: 2400,
        totalCo2Kg: 300,
        materials: [{ material: "Concrete", probability: 1, areaM2: 2, volumeM3: 1, massKg: 2400, co2Kg: 300 }],
      },
    }),
  });
}

test("initial migration declares every required waste_reports column", async () => {
  const [schema, migration, migrationRunner, renderConfig, dbIndex] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0000_marvelous_veda.sql"),
    read("scripts/migrate.mjs"),
    read("render.yaml"),
    read("db/index.ts"),
  ]);
  assert.match(migration, /CREATE TABLE "waste_reports"/);
  for (const column of requiredColumns) assert.match(migration, new RegExp(`"${column}"`));
  assert.match(migrationRunner, /information_schema\.columns/);
  assert.match(migrationRunner, /public.*waste_reports/);
  assert.match(renderConfig, /preDeployCommand: npm run db:migrate/);
  assert.match(dbIndex, /process\.env\.POSTGRES_URL/);
  assert.doesNotMatch(dbIndex, /process\.env\.DATABASE_URL/);
  assert.match(dbIndex, /cannot point to localhost in production/);
  assert.match(schema, /export const wasteReports = pgTable\("waste_reports"/);
});

test("report insert is transactional and returns a saved report", async () => {
  const route = await loadReportsRoute();
  const inserts = [];
  globalThis.__testReportsDb = {
    transaction: async (callback) => callback({
      insert: (table) => ({
        values: async (values) => inserts.push({ table, values }),
      }),
    }),
  };
  try {
    const response = await route.POST(reportRequest());
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.success, true);
    assert.match(body.report.id, /^NG-/);
    assert.equal(inserts.length, 3);
    assert.equal(inserts[0].values.ownerEmail, "9876543210@mobile.nirmalgwalior.in");
    assert.equal(inserts[0].values.imageObjectKey, null);
  } finally {
    delete globalThis.__testReportsDb;
  }
});

test("recyclers and authorities can read the shared generator report feed", async () => {
  const route = await read("app/api/reports/route.ts");
  assert.match(route, /requireRole\(request, \["generator", "recycler", "authority"\]\)/);
  assert.match(route, /authorization\.session\.role === "generator"/);
  assert.match(route, /limit\(100\)/);
  const component = await read("app/components/CdwPlatform.tsx");
  assert.match(component, /fetch\("\/api\/reports", \{ cache: "no-store", credentials: "include" \}\)/);
  assert.match(component, /<RecyclerWorkspace activeView=\{activeView\} reports=\{reports\}/);
  assert.match(component, /report\.imageUrl/);
  assert.match(component, /Generator submissions/);
});

test("database failures log original SQLSTATE but return safe JSON", async () => {
  const route = await loadReportsRoute();
  const databaseError = new Error('relation "waste_reports" does not exist');
  databaseError.code = "42P01";
  const queryError = new Error('Failed query: insert into "waste_reports"');
  queryError.cause = databaseError;
  globalThis.__testReportsDb = { transaction: async () => { throw queryError; } };
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  try {
    const response = await route.POST(reportRequest());
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.success, false);
    assert.equal(body.error, "Unable to save report");
    assert.match(body.details, /Run the database migrations on Render/);
    assert.doesNotMatch(JSON.stringify(body), /Failed query|relation/);
    assert.equal(logs[0][1].sqlState, "42P01");
    assert.match(logs[0][1].message, /waste_reports.*does not exist/);
  } finally {
    console.error = originalConsoleError;
    delete globalThis.__testReportsDb;
  }
});
