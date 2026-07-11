import { canResend, checkOtpRequestRate, clientIp, noStoreJson, normalizeIndianMobile, saveOtp, type CdwRole } from "../../../auth/server";
import { createOtp, getSmsProvider, isDemoOtpMode } from "../../../auth/sms-provider";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { mobile?: unknown; role?: unknown };
  const mobile = normalizeIndianMobile(payload.mobile);
  const role: CdwRole | null = payload.role === "generator" || payload.role === "recycler" || payload.role === "authority" ? payload.role : null;
  if (!mobile) return noStoreJson({ error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
  if (!role) return noStoreJson({ error: "You are not authorized to access this workspace." }, { status: 403 });
  if (!canResend(mobile)) return noStoreJson({ error: "Please wait 60 seconds before requesting another OTP." }, { status: 429 });
  if (!checkOtpRequestRate(mobile, clientIp(request))) return noStoreJson({ error: "Too many OTP requests. Please try again later." }, { status: 429 });
  try {
    if (isDemoOtpMode()) {
      await saveOtp(mobile, "123456", role);
      return noStoreJson({ success: true, demoMode: true, message: "Demo OTP generated" });
    }
    const otp = createOtp();
    await saveOtp(mobile, otp, role);
    await getSmsProvider().sendOtp(mobile, otp);
    return noStoreJson({ success: true, demoMode: false, message: "OTP sent" });
  } catch {
    return noStoreJson({ error: "Unable to resend OTP right now." }, { status: 503 });
  }
}
