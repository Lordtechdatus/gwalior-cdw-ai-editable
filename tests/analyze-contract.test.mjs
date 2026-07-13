import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function loadAnalyzeRoute() {
  const source = (await read("app/api/analyze/route.ts")).replace(
    'import { requireRole } from "../../auth/server";',
    "const requireRole = async () => ({ ok: true, session: {} });",
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

function validPngFile() {
  return new File(
    [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])],
    "site.png",
    { type: "image/png" },
  );
}

function analyzeRequest(file = validPngFile()) {
  const body = new FormData();
  body.append("image", file);
  body.append("cameraHeight", "3");
  body.append("fov", "60");
  return new Request("http://localhost/api/analyze", { method: "POST", body });
}

test("prototype analysis is deterministic and never calls an external AI URL", async () => {
  const route = await loadAnalyzeRoute();
  const originalMode = process.env.CDW_INFERENCE_MODE;
  const originalUrl = process.env.AI_API_URL;
  const originalFetch = globalThis.fetch;
  process.env.CDW_INFERENCE_MODE = "prototype";
  process.env.AI_API_URL = "https://must-not-be-called.invalid";
  globalThis.fetch = async () => {
    throw new Error("prototype mode attempted an external request");
  };

  try {
    const first = await route.POST(analyzeRequest());
    const second = await route.POST(analyzeRequest());
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.match(first.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await first.json(), await second.json());
  } finally {
    globalThis.fetch = originalFetch;
    if (originalMode === undefined) delete process.env.CDW_INFERENCE_MODE;
    else process.env.CDW_INFERENCE_MODE = originalMode;
    if (originalUrl === undefined) delete process.env.AI_API_URL;
    else process.env.AI_API_URL = originalUrl;
  }
});

test("invalid multipart images return the stable JSON error contract", async () => {
  const route = await loadAnalyzeRoute();
  const originalConsoleError = console.error;
  const loggedErrors = [];
  const invalidCases = [
    new File([], "empty.png", { type: "image/png" }),
    new File(["not an image"], "fake.png", { type: "image/png" }),
    new File(["plain text"], "notes.txt", { type: "text/plain" }),
  ];

  console.error = (...values) => loggedErrors.push(values);
  try {
    for (const file of invalidCases) {
      const response = await route.POST(analyzeRequest(file));
      const body = await response.json();
      assert.equal(response.status, 500);
      assert.equal(body.success, false);
      assert.equal(body.error, "AI analysis failed");
      assert.equal(typeof body.details, "string");
      assert.ok(body.details.length > 0);
    }
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(loggedErrors.length, invalidCases.length);
  assert.ok(loggedErrors.every((entry) => entry[1] instanceof Error));
});

test("the analyze client reads text before safely parsing JSON", async () => {
  const component = await read("app/components/CdwPlatform.tsx");
  const analyzeFunction = component.slice(
    component.indexOf("async function analyseImage()"),
    component.indexOf("async function submitReport()"),
  );
  assert.match(analyzeFunction, /const responseText = await response\.text\(\)/);
  assert.match(analyzeFunction, /JSON\.parse\(responseText\)/);
  assert.doesNotMatch(analyzeFunction, /response\.json\(\)/);
  assert.match(analyzeFunction, /Server returned invalid JSON/);
  assert.match(analyzeFunction, /Server returned an empty response/);
});
