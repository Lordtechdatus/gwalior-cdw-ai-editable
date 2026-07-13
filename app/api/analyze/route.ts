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

function errorDetails(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown server error.";
}

function serviceUnavailableResponse(error: unknown, status = 500) {
  return Response.json(
    {
      error: AI_UNAVAILABLE_MESSAGE,
      details: errorDetails(error),
    },
    { status },
  );
}

function isPrototypeMode() {
  const mode = process.env.AI_ANALYSIS_MODE?.trim().toLowerCase();
  return (
    mode === "prototype" ||
    mode === "demo" ||
    process.env.AI_DEMO_MODE === "true" ||
    process.env.DEMO_MODE === "true"
  );
}

function configuredAiBaseUrl() {
  const configuredUrl =
    process.env.AI_API_URL?.trim() || process.env.NEXT_PUBLIC_AI_API_URL?.trim();
  if (!configuredUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Error("AI_API_URL or NEXT_PUBLIC_AI_API_URL must be a valid URL.");
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
  if (isPrototypeMode()) return null;

  const baseUrl = configuredAiBaseUrl();
  if (!baseUrl) {
    throw new Error(
      "AI_API_URL or NEXT_PUBLIC_AI_API_URL must be configured unless prototype/demo mode is enabled.",
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
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? String(payload.detail)
          : `Analysis returned HTTP ${response.status}.`;
      throw new Error(detail);
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
    if (!authorization.ok) return authorization.response;

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return Response.json(
        {
          error: "An image file is required.",
          details: "POST /api/analyze expects multipart/form-data with an image field.",
        },
        { status: 415 },
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || typeof image === "string") {
      return Response.json(
        {
          error: "An image file is required.",
          details: "Upload the image as a multipart file field named image.",
        },
        { status: 400 },
      );
    }
    if (!image.type.startsWith("image/")) {
      return Response.json(
        {
          error: "Only image uploads are accepted.",
          details: `Received content type ${image.type || "unknown"}.`,
        },
        { status: 415 },
      );
    }
    if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
      return Response.json(
        {
          error: "The image must be between 1 byte and 10 MB.",
          details: `Received ${image.size} bytes.`,
        },
        { status: 413 },
      );
    }

    const cameraHeight = parseBoundedNumber(formData, "cameraHeight", 3, 1, 8);
    const fov = parseBoundedNumber(formData, "fov", 60, 30, 120);
    const serviceResult = await callConfiguredInferenceService(image, cameraHeight, fov);
    if (serviceResult) return Response.json(serviceResult);

    const bytes = await image.arrayBuffer();
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
      analysisId: `PROTO-${analysisId}`,
      mode: "prototype",
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
    if (error instanceof AiServiceUnavailableError) {
      return serviceUnavailableResponse(error.cause ?? error, 503);
    }
    return serviceUnavailableResponse(error, 500);
  }
}
