const baseUrl = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const skipReport = process.argv.includes("--skip-report");
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

const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
  headers: { cookie },
});
const sessionText = await sessionResponse.text();
const session = JSON.parse(sessionText);
if (!sessionResponse.ok || session.authenticated !== true || session.role !== "generator") {
  throw new Error(`Session refresh failed with HTTP ${sessionResponse.status}.`);
}

function imageFile() {
  return new File(
    [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])],
    "site.png",
    { type: "image/png" },
  );
}

const uploadForm = new FormData();
uploadForm.append("image", imageFile());
const uploadResponse = await fetch(`${baseUrl}/api/uploads`, {
  method: "POST",
  headers: { cookie },
  body: uploadForm,
});
const uploadText = await uploadResponse.text();
const upload = JSON.parse(uploadText);
if (!uploadResponse.ok || upload.success !== true) {
  throw new Error(
    `Upload failed (HTTP ${uploadResponse.status}): ${upload.details ?? upload.error ?? "unknown error"}`,
  );
}
if (upload.storage !== "prototype-disabled" && !upload.imageUrl) {
  throw new Error("Upload succeeded without an image URL or prototype-disabled storage mode.");
}

const formData = new FormData();
formData.append(
  "image",
  imageFile(),
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

let reportStatus = null;
let reportId = null;
if (!skipReport) {
  const reportResponse = await fetch(`${baseUrl}/api/reports`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      siteName: "Render smoke test",
      ward: "Lashkar",
      cameraHeightM: 3,
      horizontalFovDeg: 60,
      imageObjectKey: upload.imageUrl ?? null,
      analysis: payload,
    }),
  });
  const reportText = await reportResponse.text();
  let reportPayload;
  try {
    reportPayload = JSON.parse(reportText);
  } catch {
    throw new Error(
      `Report submission returned non-JSON content (HTTP ${reportResponse.status}): ${reportText || "<empty>"}`,
    );
  }
  if (!reportResponse.ok || !reportPayload.report?.id) {
    throw new Error(
      `Report confirmation failed (HTTP ${reportResponse.status}): ${reportPayload.error ?? "unknown error"}`,
    );
  }
  reportStatus = reportResponse.status;
  reportId = reportPayload.report.id;
}

console.log(
  JSON.stringify(
    {
      sendOtpStatus: sendOtp.status,
      verifyOtpStatus: verifyOtp.status,
      sessionStatus: sessionResponse.status,
      authenticated: session.authenticated,
      uploadStatus: uploadResponse.status,
      uploadBodyEmpty: uploadText.length === 0,
      uploadStorage: upload.storage,
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
      reportStatus,
      reportId,
      reportSkipped: skipReport,
    },
    null,
    2,
  ),
);
