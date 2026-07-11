import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["generator", "recycler", "authority"] })
      .notNull()
      .default("generator"),
    organization: text("organization"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const wasteReports = sqliteTable(
  "waste_reports",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    siteName: text("site_name").notNull(),
    ward: text("ward").notNull(),
    latitude: real("latitude"),
    longitude: real("longitude"),
    cameraHeightM: real("camera_height_m").notNull(),
    horizontalFovDeg: real("horizontal_fov_deg").notNull(),
    imageObjectKey: text("image_object_key"),
    analysisId: text("analysis_id").notNull(),
    analysisMode: text("analysis_mode").notNull().default("prototype"),
    modelVersion: text("model_version").notNull().default("prototype-0.1"),
    dominantMaterial: text("dominant_material").notNull(),
    confidence: real("confidence").notNull(),
    manualReviewRequired: integer("manual_review_required", { mode: "boolean" })
      .notNull()
      .default(true),
    totalAreaM2: real("total_area_m2").notNull(),
    totalVolumeM3: real("total_volume_m3").notNull(),
    totalMassKg: real("total_mass_kg").notNull(),
    totalCo2Kg: real("total_co2_kg").notNull(),
    status: text("status").notNull().default("Submitted"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("waste_reports_owner_idx").on(table.ownerEmail),
    index("waste_reports_status_idx").on(table.status),
    index("waste_reports_created_idx").on(table.createdAt),
    index("waste_reports_ward_idx").on(table.ward),
  ],
);

export const materialEstimates = sqliteTable(
  "material_estimates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: text("report_id")
      .notNull()
      .references(() => wasteReports.id, { onDelete: "cascade" }),
    material: text("material").notNull(),
    probability: real("probability").notNull(),
    areaM2: real("area_m2").notNull(),
    volumeM3: real("volume_m3").notNull(),
    massKg: real("mass_kg").notNull(),
    co2Kg: real("co2_kg").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("material_estimates_report_idx").on(table.reportId),
    index("material_estimates_material_idx").on(table.material),
  ],
);

export const statusEvents = sqliteTable(
  "status_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: text("report_id")
      .notNull()
      .references(() => wasteReports.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    actorEmail: text("actor_email").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("status_events_report_idx").on(table.reportId),
    index("status_events_created_idx").on(table.createdAt),
  ],
);

export const collectionAssignments = sqliteTable(
  "collection_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: text("report_id")
      .notNull()
      .references(() => wasteReports.id, { onDelete: "cascade" }),
    vehicleNumber: text("vehicle_number").notNull(),
    vehicleType: text("vehicle_type").notNull(),
    driverName: text("driver_name").notNull(),
    driverContactMasked: text("driver_contact_masked"),
    recyclerDestination: text("recycler_destination").notNull(),
    scheduledAt: text("scheduled_at").notNull(),
    estimatedArrivalAt: text("estimated_arrival_at"),
    status: text("status").notNull().default("Scheduled"),
    assignedByEmail: text("assigned_by_email").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("collection_assignments_report_unique").on(table.reportId),
    index("collection_assignments_scheduled_idx").on(table.scheduledAt),
  ],
);

export const recyclingReceipts = sqliteTable(
  "recycling_receipts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: text("report_id")
      .notNull()
      .references(() => wasteReports.id, { onDelete: "cascade" }),
    recyclerEmail: text("recycler_email").notNull(),
    receivedMassKg: real("received_mass_kg").notNull(),
    recoveredMassKg: real("recovered_mass_kg").notNull(),
    rejectedMassKg: real("rejected_mass_kg").notNull().default(0),
    certificateNumber: text("certificate_number"),
    evidenceObjectKey: text("evidence_object_key"),
    status: text("status").notNull().default("Draft"),
    receivedAt: text("received_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("recycling_receipts_report_unique").on(table.reportId),
    index("recycling_receipts_recycler_idx").on(table.recyclerEmail),
  ],
);

export const modelVersions = sqliteTable(
  "model_versions",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    mode: text("mode").notNull(),
    confidenceThreshold: real("confidence_threshold").notNull().default(0.7),
    configurationJson: text("configuration_json").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(false),
    createdByEmail: text("created_by_email").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("model_versions_active_idx").on(table.active)],
);
