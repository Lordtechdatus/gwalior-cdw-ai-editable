import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { materialEstimates, statusEvents, wasteReports } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

type MaterialPayload = {
  material: string;
  probability: number;
  areaM2: number;
  volumeM3: number;
  massKg: number;
  co2Kg: number;
};

type ReportPayload = {
  siteName?: string;
  ward?: string;
  cameraHeightM?: number;
  horizontalFovDeg?: number;
  imageObjectKey?: string | null;
  analysis?: {
    analysisId?: string;
    mode?: string;
    dominantMaterial?: string;
    confidence?: number;
    manualReviewRequired?: boolean;
    totalAreaM2?: number;
    totalVolumeM3?: number;
    totalMassKg?: number;
    totalCo2Kg?: number;
    materials?: MaterialPayload[];
  };
};

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function reportId() {
  const year = new Date().getUTCFullYear();
  return `NG-${year}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  try {
    const db = await getDb();
    const reports = await db
      .select()
      .from(wasteReports)
      .where(eq(wasteReports.ownerEmail, user.email))
      .orderBy(desc(wasteReports.createdAt))
      .limit(50);
    return Response.json({ reports });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load reports." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as ReportPayload;
    const analysis = payload.analysis;
    const siteName = payload.siteName?.trim();
    const ward = payload.ward?.trim();
    const cameraHeightM = finiteNumber(payload.cameraHeightM);
    const horizontalFovDeg = finiteNumber(payload.horizontalFovDeg);
    const confidence = finiteNumber(analysis?.confidence);
    const totalAreaM2 = finiteNumber(analysis?.totalAreaM2);
    const totalVolumeM3 = finiteNumber(analysis?.totalVolumeM3);
    const totalMassKg = finiteNumber(analysis?.totalMassKg);
    const totalCo2Kg = finiteNumber(analysis?.totalCo2Kg);

    if (
      !siteName ||
      !ward ||
      !analysis?.analysisId ||
      !analysis.dominantMaterial ||
      cameraHeightM === null ||
      horizontalFovDeg === null ||
      confidence === null ||
      totalAreaM2 === null ||
      totalVolumeM3 === null ||
      totalMassKg === null ||
      totalCo2Kg === null ||
      !Array.isArray(analysis.materials)
    ) {
      return Response.json({ error: "The report payload is incomplete." }, { status: 400 });
    }

    const id = reportId();
    const manualReviewRequired = Boolean(analysis.manualReviewRequired);
    const status = manualReviewRequired ? "Review" : "Submitted";
    const db = await getDb();

    await db.insert(wasteReports).values({
      id,
      ownerEmail: user.email,
      siteName,
      ward,
      cameraHeightM,
      horizontalFovDeg,
      imageObjectKey: payload.imageObjectKey ?? null,
      analysisId: analysis.analysisId,
      analysisMode: analysis.mode ?? "prototype",
      modelVersion: analysis.mode === "prototype" ? "prototype-0.1" : "external-service",
      dominantMaterial: analysis.dominantMaterial,
      confidence,
      manualReviewRequired,
      totalAreaM2,
      totalVolumeM3,
      totalMassKg,
      totalCo2Kg,
      status,
    });

    if (analysis.materials.length > 0) {
      await db.insert(materialEstimates).values(
        analysis.materials.map((material) => ({
          reportId: id,
          material: material.material,
          probability: material.probability,
          areaM2: material.areaM2,
          volumeM3: material.volumeM3,
          massKg: material.massKg,
          co2Kg: material.co2Kg,
        })),
      );
    }

    await db.insert(statusEvents).values({
      reportId: id,
      status,
      actorEmail: user.email,
      note: manualReviewRequired
        ? "Automatically routed for manual review because confidence is below the configured threshold."
        : "Report submitted from the generator workspace.",
    });

    return Response.json({ report: { id, status } }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save the report." },
      { status: 500 },
    );
  }
}
