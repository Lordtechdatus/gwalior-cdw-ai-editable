const baseUrl = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const mobile = process.env.SMOKE_TEST_MOBILE ?? "9876543298";
const otp = process.env.SMOKE_TEST_OTP ?? "123456";

async function postJson(path, body, cookie) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

const sendOtp = await postJson("/api/auth/send-otp", { mobile, role: "generator" });
if (!sendOtp.ok) throw new Error(`OTP request failed with HTTP ${sendOtp.status}.`);

const verifyOtp = await postJson("/api/auth/verify-otp", {
  mobile,
  otp,
  role: "generator",
});
if (!verifyOtp.ok) throw new Error(`OTP verification failed with HTTP ${verifyOtp.status}.`);
const cookie = verifyOtp.headers.getSetCookie()[0]?.split(";", 1)[0];
if (!cookie) throw new Error("OTP verification did not return a session cookie.");

const formData = new FormData();
formData.append(
  "image",
  new File(
    [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])],
    "site.png",
    { type: "image/png" },
  ),
);
formData.append("cameraHeight", "3");
formData.append("fov", "60");

const response = await fetch(`${baseUrl}/api/analyze`, {
  method: "POST",
  headers: { cookie },
  body: formData,
});
const responseText = await response.text();
let payload;
try {
  payload = JSON.parse(responseText);
} catch {
  throw new Error(
    `Analyze returned non-JSON content (HTTP ${response.status}): ${responseText || "<empty>"}`,
  );
}
if (!response.ok || payload.success !== true) {
  throw new Error(
    `Analyze failed (HTTP ${response.status}): ${payload.details ?? payload.error ?? "unknown error"}`,
  );
}
if (!payload.analysisId || !Array.isArray(payload.materials) || payload.materials.length === 0) {
  throw new Error("Analyze JSON is missing the estimate fields required by the review screen.");
}

console.log(
  JSON.stringify(
    {
      sendOtpStatus: sendOtp.status,
      verifyOtpStatus: verifyOtp.status,
      analyzeStatus: response.status,
      contentType: response.headers.get("content-type"),
      responseBodyEmpty: responseText.length === 0,
      success: payload.success,
      mode: payload.mode,
      analysisId: payload.analysisId,
      dominantMaterial: payload.dominantMaterial,
      totalVolumeM3: payload.totalVolumeM3,
      totalMassKg: payload.totalMassKg,
      materialRows: payload.materials.length,
    },
    null,
    2,
  ),
);
