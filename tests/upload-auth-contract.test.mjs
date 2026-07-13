import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function loadTypescriptModule(path, replacements) {
  let source = await read(path);
  for (const [from, to] of replacements) source = source.replace(from, to);
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

function imageRequest() {
  const body = new FormData();
  body.append(
    "image",
    new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1])], "site.png", {
      type: "image/png",
    }),
  );
  return new Request("https://example.onrender.com/api/uploads", { method: "POST", body });
}

test("missing and expired sessions return the required 401 JSON", async () => {
  globalThis.__testSession = null;
  const route = await loadTypescriptModule("app/api/auth/session/route.ts", [
    [
      'import { getSession, noStoreJson } from "../../../auth/server";',
      "const getSession = async () => globalThis.__testSession; const noStoreJson = (body, init = {}) => Response.json(body, init);",
    ],
  ]);
  const response = await route.GET(new Request("https://example.onrender.com/api/auth/session"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { authenticated: false });
});

test("uploads always return JSON for authentication, failure, and success paths", async () => {
  const route = await loadTypescriptModule("app/api/uploads/route.ts", [
    [
      'import { put } from "@vercel/blob";',
      'const put = async () => ({ url: "https://blob.example/site.png" });',
    ],
    [
      'import { requireRole } from "../../auth/server";',
      "const requireRole = async () => globalThis.__testUploadAuthorization;",
    ],
  ]);
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  const originalConsoleError = console.error;
  const loggedErrors = [];
  console.error = (...values) => loggedErrors.push(values);

  try {
    globalThis.__testUploadAuthorization = {
      ok: false,
      response: Response.json({}, { status: 401 }),
    };
    const unauthenticated = await route.POST(imageRequest());
    assert.equal(unauthenticated.status, 401);
    assert.deepEqual(await unauthenticated.json(), {
      success: false,
      error: "Authentication required",
    });

    globalThis.__testUploadAuthorization = { ok: true, session: { mobile: "9876543210" } };
    const malformed = await route.POST(
      new Request("https://example.onrender.com/api/uploads", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=broken" },
        body: "not multipart",
      }),
    );
    assert.equal(malformed.status, 500);
    assert.equal((await malformed.json()).success, false);
    assert.equal(loggedErrors.length, 1);
    assert.ok(loggedErrors[0][1] instanceof Error);

    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const success = await route.POST(imageRequest());
    const successBody = await success.json();
    assert.equal(success.status, 200);
    assert.equal(successBody.success, true);
    assert.equal(successBody.objectKey, "https://blob.example/site.png");
  } finally {
    console.error = originalConsoleError;
    delete globalThis.__testSession;
    delete globalThis.__testUploadAuthorization;
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  }
});

test("frontend auth and upload requests use credentialed safe JSON parsing", async () => {
  const component = await read("app/components/CdwPlatform.tsx");
  assert.match(component, /async function readJsonResponse<[\s\S]*response\.text\(\)/);
  assert.match(component, /fetch\("\/api\/auth\/session", \{[\s\S]*?credentials: "include"/);
  assert.match(component, /fetch\("\/api\/auth\/verify-otp", \{[^\n]*credentials: "include"/);
  assert.match(component, /const sessionResponse = await fetch\("\/api\/auth\/session"/);
  assert.match(component, /fetch\("\/api\/uploads", \{[\s\S]*?credentials: "include"/);
  assert.doesNotMatch(
    component.slice(component.indexOf("async function submitReport()"), component.indexOf("return (", component.indexOf("async function submitReport()"))),
    /\.json\(\)/,
  );
});
