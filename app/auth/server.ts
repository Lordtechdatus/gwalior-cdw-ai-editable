type OtpRecord = {
  mobile: string;
  role: CdwRole | null;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
};

export type CdwRole = "generator" | "recycler" | "authority";

type SessionRecord = {
  mobile: string;
  role: CdwRole | null;
  expiresAt: number;
};

type RateRecord = { count: number; resetAt: number };

const globalAuth = globalThis as typeof globalThis & {
  cdwOtpRecords?: Map<string, OtpRecord>;
  cdwSessions?: Map<string, SessionRecord>;
  cdwRateLimits?: Map<string, RateRecord>;
};

const otpRecords = (globalAuth.cdwOtpRecords ??= new Map());
const sessions = (globalAuth.cdwSessions ??= new Map());
const rateLimits = (globalAuth.cdwRateLimits ??= new Map());

export const SESSION_COOKIE = "cdw_session";
export const OTP_LIFETIME_MS = 10 * 60 * 1000;
export const RESEND_DELAY_MS = 60 * 1000;
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToHex(value);
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

async function otpHash(mobile: string, otp: string) {
  const secret = process.env.AUTH_OTP_HASH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_OTP_HASH_SECRET must be configured in production.");
  }
  return digest(`${secret ?? "local-development-only"}:${mobile}:${otp}`);
}

export function normalizeIndianMobile(value: unknown) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

function consumeRateLimit(key: string, maximum: number) {
  const now = Date.now();
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= maximum) return false;
  current.count += 1;
  return true;
}

export function checkOtpRequestRate(mobile: string, ip: string) {
  return consumeRateLimit(`mobile:${mobile}`, 5) && consumeRateLimit(`ip:${ip}`, 20);
}

export function getOtpRecord(mobile: string) {
  return otpRecords.get(mobile) ?? null;
}

export async function saveOtp(mobile: string, otp: string, role: CdwRole | null = null) {
  const now = Date.now();
  otpRecords.set(mobile, {
    mobile,
    role,
    otpHash: await otpHash(mobile, otp),
    expiresAt: now + OTP_LIFETIME_MS,
    attempts: 0,
    lastSentAt: now,
  });
}

export async function verifyOtpValue(mobile: string, otp: string, role: CdwRole | null = null) {
  const record = otpRecords.get(mobile);
  if (!record) return { ok: false as const, reason: "missing" as const };
  if (record.expiresAt <= Date.now()) {
    otpRecords.delete(mobile);
    return { ok: false as const, reason: "expired" as const };
  }
  if (record.attempts >= 5) return { ok: false as const, reason: "attempts" as const };
  record.attempts += 1;
  if (record.role && record.role !== role) return { ok: false as const, reason: "unauthorized" as const };
  if ((await otpHash(mobile, otp)) !== record.otpHash) {
    return { ok: false as const, reason: record.attempts >= 5 ? "attempts" as const : "invalid" as const };
  }
  otpRecords.delete(mobile);
  return { ok: true as const };
}

export function canResend(mobile: string) {
  const record = otpRecords.get(mobile);
  return !record || Date.now() - record.lastSentAt >= RESEND_DELAY_MS;
}

export async function createSession(mobile: string, role: CdwRole) {
  const token = randomToken();
  sessions.set(await digest(token), { mobile, role, expiresAt: Date.now() + SESSION_LIFETIME_MS });
  return token;
}

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function getSession(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const key = await digest(token);
  const session = sessions.get(key);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(key);
    return null;
  }
  return { key, ...session };
}

export async function requireRole(request: Request, allowed: CdwRole[]) {
  const session = await getSession(request);
  if (!session) return { ok: false as const, response: noStoreJson({ error: "Authentication is required." }, { status: 401 }) };
  if (!session.role || !allowed.includes(session.role)) return { ok: false as const, response: noStoreJson({ error: "This role is not authorized for the requested operation." }, { status: 403 }) };
  return { ok: true as const, session };
}

export async function selectSessionRole(request: Request, role: unknown) {
  if (role !== "generator" && role !== "recycler" && role !== "authority") return null;
  const session = await getSession(request);
  // A role is selected before OTP verification and permanently bound when the
  // session is created. Never allow a client to swap workspaces afterward.
  if (!session || session.role) return null;
  const updated = { mobile: session.mobile, role, expiresAt: session.expiresAt };
  sessions.set(session.key, updated);
  return updated;
}

export async function destroySession(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) sessions.delete(await digest(token));
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_LIFETIME_MS / 1000}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function noStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}
