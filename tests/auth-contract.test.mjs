import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("authentication routes and secure session controls are present", async () => {
  const [server, component] = await Promise.all([
    read("app/auth/server.ts"),
    read("app/components/CdwPlatform.tsx"),
  ]);
  for (const route of ["send-otp", "verify-otp", "resend-otp", "logout", "session"]) {
    assert.equal(await read(`app/api/auth/${route}/route.ts`).then(() => true), true);
  }
  assert.match(server, /crypto\.subtle\.digest/);
  assert.match(server, /attempts >= 5/);
  assert.match(server, /10 \* 60 \* 1000/);
  assert.match(server, /HttpOnly; SameSite=Strict/);
  assert.match(server, /Secure/);
  assert.doesNotMatch(server, /otp:\s*otp\b/);
  assert.match(component, /"role-selection" \| "generator-login" \| "recycler-login" \| "authority-login" \| "otp-verification"/);
  assert.match(component, /session\.authenticated && session\.role === role/);
  assert.match(await read("app/api/auth/verify-otp/route.ts"), /verifyOtpValue\(mobile, otp, role\)/);
  assert.match(await read("app/api/auth/send-otp/route.ts"), /if \(!role\).*403/s);
});

test("demo OTP is explicitly development-gated and never returned by an API", async () => {
  const [example, localEnv, provider, component, sendRoute, verifyRoute] = await Promise.all([
    read(".env.example"),
    read(".env.local"),
    read("app/auth/sms-provider.ts"),
    read("app/components/CdwPlatform.tsx"),
    read("app/api/auth/send-otp/route.ts"),
    read("app/api/auth/verify-otp/route.ts"),
  ]);
  assert.match(example, /DEMO_OTP_MODE=true/);
  assert.match(localEnv, /DEMO_OTP_MODE=true/);
  assert.match(localEnv, /NEXT_PUBLIC_DEMO_OTP_MODE=true/);
  assert.match(provider, /!import\.meta\.env\.PROD && import\.meta\.env\.DEMO_OTP_MODE === "true"/);
  assert.match(provider, /return "123456"/);
  assert.match(component, /demoMode && <p[^>]*>Demo OTP: 123456<\/p>/);
  assert.match(component, /setOtpSent\(true\);\s*onSent\(true\)/);
  assert.match(sendRoute, /success: true, demoMode: true, message: "Demo OTP generated"/);
  assert.doesNotMatch(sendRoute, /\{[^}]*otp[,}]/s);
  assert.doesNotMatch(verifyRoute, /console\./);
});

test("protected generator APIs require the server-bound generator role", async () => {
  const sources = await Promise.all([
    read("app/api/analyze/route.ts"),
    read("app/api/uploads/route.ts"),
    read("app/api/reports/route.ts"),
  ]);
  for (const source of sources) assert.match(source, /requireRole\(request, \["generator"\]\)/);
});

test("OTP verification binds the requested role into the session", async () => {
  const [verifyRoute, server] = await Promise.all([
    read("app/api/auth/verify-otp/route.ts"),
    read("app/auth/server.ts"),
  ]);
  assert.match(verifyRoute, /createSession\(mobile, role\)/);
  assert.match(verifyRoute, /payload\.role/);
  assert.match(server, /if \(!session \|\| session\.role\) return null/);
});

test("OTP records expire after ten minutes and stop verification", async () => {
  const source = await read("app/auth/server.ts");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const auth = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
  const originalNow = Date.now;
  const initialTime = 1_800_000_000_000;
  try {
    Date.now = () => initialTime;
    await auth.saveOtp("9876543299", "123456");
    Date.now = () => initialTime + 10 * 60 * 1000 + 1;
    assert.deepEqual(await auth.verifyOtpValue("9876543299", "123456"), { ok: false, reason: "expired" });
  } finally {
    Date.now = originalNow;
  }
});
