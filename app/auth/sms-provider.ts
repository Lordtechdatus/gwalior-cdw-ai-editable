export interface SmsProvider {
  sendOtp(mobile: string, otp: string): Promise<void>;
}

class DemoSmsProvider implements SmsProvider {
  async sendOtp() {
    // Intentionally silent: the development OTP is documented in .env.example,
    // never returned by an API response or written to browser/server logs.
  }
}

export function isDemoOtpMode() {
  return process.env.DEMO_OTP_MODE === "true";
}

export function createOtp() {
  if (!isDemoOtpMode()) throw new Error("No production SMS provider is configured.");
  return process.env.OTP ?? "123456";
}

export function getSmsProvider(): SmsProvider {
  if (isDemoOtpMode()) return new DemoSmsProvider();
  throw new Error("No production SMS provider is configured.");
}
