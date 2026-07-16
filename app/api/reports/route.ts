import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { materialEstimates, statusEvents, wasteReports } from "../../../db/schema";
import { requireRole } from "../../auth/server";

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

function databaseDiagnostic(error: unknown) {
  let current: unknown = error;
  let message = error instanceof Error ? error.message : "Unknown database error";
  let sqlState: string | null = null;

  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { message?: unknown; code?: unknown; cause?: unknown };
    if (typeof candidate.message === "string") message = candidate.message;
    if (typeof candidate.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      sqlState = candidate.code;
    }
    current = candidate.cause;
  }
  return { message, sqlState };
}

function databaseErrorDetails(sqlState: string | null, message: string) {
  if (sqlState === "42P01") return "Report storage is not initialized. Run the database migrations on Render.";
  if (sqlState === "42703") return "The report storage schema is out of date. Run the database migrations on Render.";
  if (sqlState === "28P01") return "Database authentication failed. Check POSTGRES_URL on Render.";
  if (sqlState === "3D000") return "The configured Render PostgreSQL database does not exist.";
  if (sqlState === "23505") return "A report with this identifier already exists. Please retry.";
  if (
    message.includes("POSTGRES_URL") ||
    message.toLowerCase().includes("connect") ||
    message.toLowerCase().includes("timeout")
  ) {
    return "The report database is unavailable. Check POSTGRES_URL and the Render database status.";
  }
  return "The report could not be saved. Check the server logs for the database diagnostic.";
}

export async function GET(request: Request) {
  const authorization = await requireRole(request, ["generator", "recycler", "authority"]);
  if (!authorization.ok) return authorization.response;
  const ownerId = `${authorization.session.mobile}@mobile.nirmalgwalior.in`;

  try {
    const db = await getDb();
    const baseQuery = db.select().from(wasteReports);
    const reports = authorization.session.role === "generator"
      ? await baseQuery
          .where(eq(wasteReports.ownerEmail, ownerId))
          .orderBy(desc(wasteReports.createdAt))
          .limit(50)
      : await baseQuery
          .orderBy(desc(wasteReports.createdAt))
          .limit(100);
    return Response.json({ reports });
  } catch (error) {
    const diagnostic = databaseDiagnostic(error);
    console.error("[api/reports] GET database failure", {
      message: diagnostic.message,
      sqlState: diagnostic.sqlState,
      error,
    });
    return Response.json(
      {
        success: false,
        error: "Unable to load reports",
        details: databaseErrorDetails(diagnostic.sqlState, diagnostic.message),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await requireRole(request, ["generator"]);
  if (!authorization.ok) return authorization.response;
  const ownerId = `${authorization.session.mobile}@mobile.nirmalgwalior.in`;

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
    const analysisId = analysis?.analysisId?.trim();
    const dominantMaterial = analysis?.dominantMaterial?.trim();
    const materials = analysis?.materials;
    const analysisMode = analysis?.mode ?? "prototype";
    const manualReviewRequired = Boolean(analysis?.manualReviewRequired);

    if (
      !siteName ||
      !ward ||
      !analysisId ||
      !dominantMaterial ||
      cameraHeightM === null ||
      horizontalFovDeg === null ||
      confidence === null ||
      totalAreaM2 === null ||
      totalVolumeM3 === null ||
      totalMassKg === null ||
      totalCo2Kg === null ||
      !Array.isArray(materials)
    ) {
      return Response.json({ error: "The report payload is incomplete." }, { status: 400 });
    }

    const id = reportId();
    const status = manualReviewRequired ? "Review" : "Submitted";
    const db = getDb();

    await db.transaction(async (transaction) => {
      await transaction.insert(wasteReports).values({
        id,
        ownerEmail: ownerId,
        siteName,
        ward,
        cameraHeightM,
        horizontalFovDeg,
        imageObjectKey: payload.imageObjectKey ?? null,
        analysisId,
        analysisMode,
        modelVersion: analysisMode === "prototype" ? "prototype-0.1" : "external-service",
        dominantMaterial,
        confidence,
        manualReviewRequired,
        totalAreaM2,
        totalVolumeM3,
        totalMassKg,
        totalCo2Kg,
        status,
      });

      if (materials.length > 0) {
        await transaction.insert(materialEstimates).values(
          materials.map((material) => ({
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

      await transaction.insert(statusEvents).values({
        reportId: id,
        status,
        actorEmail: ownerId,
        note: manualReviewRequired
          ? "Automatically routed for manual review because confidence is below the configured threshold."
          : "Report submitted from the generator workspace.",
      });
    });

    return Response.json({ success: true, report: { id, status } }, { status: 201 });
  } catch (error) {
    const diagnostic = databaseDiagnostic(error);
    console.error("[api/reports] POST database failure", {
      message: diagnostic.message,
      sqlState: diagnostic.sqlState,
      error,
    });
    return Response.json(
      {
        success: false,
        error: "Unable to save report",
        details: databaseErrorDetails(diagnostic.sqlState, diagnostic.message),
      },
      { status: 500 },
    );
  }
}
