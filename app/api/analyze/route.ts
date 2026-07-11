type MaterialDefinition = {
  name: string;
  density: number;
  co2PerM3: number;
  color: string;
};

const MATERIALS: MaterialDefinition[] = [
  { name: "Brick", density: 1800, co2PerM3: 240, color: "#d97958" },
  { name: "Concrete", density: 2400, co2PerM3: 300, color: "#9fa9a6" },
  { name: "Soil", density: 1600, co2PerM3: 50, color: "#a5c778" },
  { name: "Steel", density: 7850, co2PerM3: 15700, color: "#8fb7d9" },
  { name: "Wood", density: 600, co2PerM3: -360, color: "#d7aa68" },
];

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

async function callConfiguredInferenceService(
  image: File,
  cameraHeight: number,
  fov: number,
) {
  const baseUrl = process.env.AI_SERVICE_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return null;

  const body = new FormData();
  body.append("image", image, image.name);
  body.append("camera_height", String(cameraHeight));
  body.append("fov", String(fov));

  const response = await fetch(`${baseUrl}/v1/analyze`, {
    method: "POST",
    headers: process.env.AI_SERVICE_TOKEN
      ? { authorization: `Bearer ${process.env.AI_SERVICE_TOKEN}` }
      : undefined,
    body,
  });
  const payload = await response.json();
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? String(payload.detail)
        : "The configured inference service failed.";
    throw new Error(detail);
  }
  return payload;
}

export async function POST(request: Request) {
  const authorization = await requireRole(request, ["generator"]);
  if (!authorization.ok) return authorization.response;
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return Response.json({ error: "An image file is required." }, { status: 400 });
    }
    if (!image.type.startsWith("image/")) {
      return Response.json({ error: "Only image uploads are accepted." }, { status: 415 });
    }
    if (image.size === 0 || image.size > 10 * 1024 * 1024) {
      return Response.json(
        { error: "The image must be between 1 byte and 10 MB." },
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
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to analyse the image.",
      },
      { status: 500 },
    );
  }
}
import { requireRole } from "../../auth/server";
