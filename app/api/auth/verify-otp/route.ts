import { createSession, noStoreJson, normalizeIndianMobile, sessionCookie, verifyOtpValue, type CdwRole } from "../../../auth/server";
import { isDemoOtpMode } from "../../../auth/sms-provider";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { mobile?: unknown; otp?: unknown; role?: unknown };
  const mobile = normalizeIndianMobile(payload.mobile);
  const otp = typeof payload.otp === "string" && /^\d{6}$/.test(payload.otp) ? payload.otp : null;
  const role: CdwRole | null = payload.role === "generator" || payload.role === "recycler" || payload.role === "authority" ? payload.role : null;
  if (!mobile || !otp || !role) return noStoreJson({ error: "A selected workspace and complete six-digit OTP are required." }, { status: 400 });
  // Demo deployments deliberately accept any complete six-digit code so the
  // workspace can be explored without an SMS provider. Real deployments keep
  // the stored, expiring OTP verification path below.
  const result = isDemoOtpMode()
    ? { ok: true as const }
    : await verifyOtpValue(mobile, otp, role);
  if (!result.ok) {
    const errors = {
      missing: "Request a new OTP to continue.",
      expired: "This OTP has expired. Request a new OTP.",
      attempts: "Maximum verification attempts reached. Request a new OTP.",
      invalid: "The OTP is incorrect. Please try again.",
      unauthorized: "You are not authorized to access this workspace.",
    };
    return noStoreJson({ error: errors[result.reason], code: result.reason }, { status: result.reason === "attempts" ? 429 : 400 });
  }
  const token = await createSession(mobile, role);
  return noStoreJson(
    { verified: true, mobile, role },
    { headers: { "Set-Cookie": sessionCookie(token) } },
  );
}
