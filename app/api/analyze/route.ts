import { requireRole } from "../../auth/server";

type MaterialDefinition = {
  name: string;
  density: number;
  co2PerM3: number;
  color: string;
};

const AI_REQUEST_TIMEOUT_MS = 30_000;
const AI_UNAVAILABLE_MESSAGE = "AI analysis service unavailable";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

class AnalyzeRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyzeRequestError";
  }
}

class AiServiceUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(AI_UNAVAILABLE_MESSAGE, { cause });
    this.name = "AiServiceUnavailableError";
  }
}

const MATERIALS: MaterialDefinition[] = [
  { name: "Brick", density: 1800, co2PerM3: 240, color: "#d97958" },
  { name: "Concrete", density: 2400, co2PerM3: 300, color: "#9fa9a6" },
  { name: "Soil", density: 1600, co2PerM3: 50, color: "#a5c778" },
  { name: "Steel", density: 7850, co2PerM3: 15700, color: "#8fb7d9" },
  { name: "Wood", density: 600, co2PerM3: -360, color: "#d7aa68" },
];

export const runtime = "nodejs";

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseBoundedNumber(
  formData: FormData,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = Number(formData.get(key));
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(maximum, Math.max(minimum, raw));
}

function safeErrorDetails(error: unknown) {
  if (error instanceof AnalyzeRequestError) return error.message;
  if (error instanceof AiServiceUnavailableError) return AI_UNAVAILABLE_MESSAGE;
  return "An unexpected server error occurred.";
}

function analysisErrorResponse(error: unknown) {
  return Response.json(
    {
      success: false,
      error: "AI analysis failed",
      details: safeErrorDetails(error),
    },
    { status: 500 },
  );
}

function hasExpectedImageSignature(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (type === "image/webp") {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

function inferenceMode() {
  return process.env.CDW_INFERENCE_MODE?.trim().toLowerCase() === "production"
    ? "production"
    : "prototype";
}

function configuredAiBaseUrl() {
  const configuredUrl =
    process.env.AI_API_URL?.trim() ||
    process.env.AI_SERVICE_URL?.trim() ||
    process.env.NEXT_PUBLIC_AI_API_URL?.trim();
  if (!configuredUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Error("AI_API_URL, AI_SERVICE_URL, or NEXT_PUBLIC_AI_API_URL must be a valid URL.");
  }

  const isLocalhost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";
  if (process.env.NODE_ENV === "production" && isLocalhost) {
    throw new Error("AI backend URL cannot use localhost in production.");
  }

  return parsed.toString().replace(/\/$/, "");
}

async function callConfiguredInferenceService(
  image: File,
  cameraHeight: number,
  fov: number,
) {
  if (inferenceMode() !== "production") return null;

  const baseUrl = configuredAiBaseUrl();
  if (!baseUrl) {
    throw new Error(
      "AI_API_URL, AI_SERVICE_URL, or NEXT_PUBLIC_AI_API_URL must be configured when CDW_INFERENCE_MODE=production.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  const body = new FormData();
  body.append("image", image, image.name);
  body.append("camera_height", String(cameraHeight));
  body.append("fov", String(fov));

  try {
    const healthResponse = await fetch(`${baseUrl}/health`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!healthResponse.ok) {
      throw new Error(`Health check returned HTTP ${healthResponse.status}.`);
    }

    const health = (await healthResponse.json().catch(() => null)) as {
      status?: unknown;
    } | null;
    if (health?.status !== "ok") {
      throw new Error(`Health check returned status ${String(health?.status)}.`);
    }

    const response = await fetch(`${baseUrl}/v1/analyze`, {
      method: "POST",
      headers: process.env.AI_SERVICE_TOKEN
        ? { authorization: `Bearer ${process.env.AI_SERVICE_TOKEN}` }
        : undefined,
      body,
      signal: controller.signal,
    });
    const responseText = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      throw new Error(
        responseText.trim()
          ? `Analysis service returned invalid JSON (HTTP ${response.status}).`
          : `Analysis service returned an empty response (HTTP ${response.status}).`,
        { cause: error },
      );
    }
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? String(payload.detail)
          : `Analysis returned HTTP ${response.status}.`;
      throw new Error(detail);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Analysis service returned an invalid JSON payload.");
    }
    return payload;
  } catch (error) {
    console.error("[waste-analysis] AI service request failed", {
      baseUrl,
      error,
    });
    throw new AiServiceUnavailableError(error);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await requireRole(request, ["generator"]);
    if (!authorization.ok) {
      throw new AnalyzeRequestError(
        authorization.response.status === 401
          ? "Authentication is required."
          : "This account is not authorized to analyze images.",
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new AnalyzeRequestError(
        "POST /api/analyze expects multipart/form-data with an image field.",
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || typeof image === "string") {
      throw new AnalyzeRequestError("Upload the image as a multipart file field named image.");
    }
    if (!SUPPORTED_IMAGE_TYPES.has(image.type.toLowerCase())) {
      throw new AnalyzeRequestError(
        "Only JPEG, PNG, and WebP image uploads are accepted.",
      );
    }
    if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
      throw new AnalyzeRequestError(
        image.size === 0
          ? "The uploaded image is empty."
          : "The uploaded image exceeds the 10 MB limit.",
      );
    }

    const bytes = await image.arrayBuffer();
    const imageBytes = new Uint8Array(bytes);
    if (!hasExpectedImageSignature(imageBytes, image.type.toLowerCase())) {
      throw new AnalyzeRequestError(
        "The uploaded file content does not match its declared image type.",
      );
    }

    const cameraHeight = parseBoundedNumber(formData, "cameraHeight", 3, 1, 8);
    const fov = parseBoundedNumber(formData, "fov", 60, 30, 120);
    const serviceResult = await callConfiguredInferenceService(image, cameraHeight, fov);
    if (serviceResult) {
      return Response.json({ ...serviceResult, success: true });
    }

    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

    const dominantIndex = digest[0] % MATERIALS.length;
    const dominantProbability = 0.56 + (digest[1] / 255) * 0.32;
    const remainderWeights = MATERIALS.map((_, index) =>
      index === dominantIndex ? 0 : 8 + (digest[index + 2] % 36),
    );
    const remainderTotal = remainderWeights.reduce((sum, value) => sum + value, 0);
    const probabilities = remainderWeights.map((weight, index) =>
      index === dominantIndex
        ? dominantProbability
        : ((1 - dominantProbability) * weight) / remainderTotal,
    );

    const groundWidth = 2 * cameraHeight * Math.tan((fov * Math.PI) / 360);
    const coverage = 0.2 + (digest[8] / 255) * 0.48;
    const totalAreaM2 = Math.max(0.25, groundWidth * groundWidth * coverage * 0.42);
    const effectiveDepth = 0.18 + (digest[9] / 255) * 0.68;
    const totalVolumeM3 = totalAreaM2 * effectiveDepth;

    const materials = MATERIALS.map((material, index) => {
      const probability = probabilities[index];
      const volumeM3 = totalVolumeM3 * probability;
      return {
        material: material.name,
        probability: round(probability),
        areaM2: round(totalAreaM2 * probability),
        volumeM3: round(volumeM3),
        massKg: round(volumeM3 * material.density, 2),
        co2Kg: round(volumeM3 * material.co2PerM3, 2),
        color: material.color,
      };
    });

    const totalMassKg = materials.reduce((sum, item) => sum + item.massKg, 0);
    const totalCo2Kg = materials.reduce((sum, item) => sum + item.co2Kg, 0);
    const dominantMaterial = MATERIALS[dominantIndex].name;
    const analysisId = Array.from(digest.slice(0, 5))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    return Response.json({
      success: true,
      analysisId: `PROTO-${analysisId}`,
      mode: inferenceMode(),
      dominantMaterial,
      confidence: round(dominantProbability),
      manualReviewRequired: dominantProbability < 0.7,
      totalAreaM2: round(totalAreaM2),
      totalVolumeM3: round(totalVolumeM3, 6),
      totalMassKg: round(totalMassKg, 2),
      totalCo2Kg: round(totalCo2Kg, 2),
      materials,
      message:
        "Deterministic prototype output. Replace this adapter with the validated classification, segmentation, and calibrated depth service before field use.",
    });
  } catch (error) {
    console.error("[api/analyze] POST failed", error);
    return analysisErrorResponse(error);
  }
}
