import {
  boolean,
  doublePrecision,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["generator", "recycler", "authority"] }).notNull().default("generator"),
  organization: text("organization"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const wasteReports = pgTable("waste_reports", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  siteName: text("site_name").notNull(),
  ward: text("ward").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  cameraHeightM: doublePrecision("camera_height_m").notNull(),
  horizontalFovDeg: doublePrecision("horizontal_fov_deg").notNull(),
  imageObjectKey: text("image_object_key"),
  analysisId: text("analysis_id").notNull(),
  analysisMode: text("analysis_mode").notNull().default("prototype"),
  modelVersion: text("model_version").notNull().default("prototype-0.1"),
  dominantMaterial: text("dominant_material").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  manualReviewRequired: boolean("manual_review_required").notNull().default(true),
  totalAreaM2: doublePrecision("total_area_m2").notNull(),
  totalVolumeM3: doublePrecision("total_volume_m3").notNull(),
  totalMassKg: doublePrecision("total_mass_kg").notNull(),
  totalCo2Kg: doublePrecision("total_co2_kg").notNull(),
  status: text("status").notNull().default("Submitted"),
  ...timestamps,
}, (table) => [
  index("waste_reports_owner_idx").on(table.ownerEmail),
  index("waste_reports_status_idx").on(table.status),
  index("waste_reports_created_idx").on(table.createdAt),
  index("waste_reports_ward_idx").on(table.ward),
]);

export const materialEstimates = pgTable("material_estimates", {
  id: serial("id").primaryKey(),
  reportId: text("report_id").notNull().references(() => wasteReports.id, { onDelete: "cascade" }),
  material: text("material").notNull(),
  probability: doublePrecision("probability").notNull(),
  areaM2: doublePrecision("area_m2").notNull(),
  volumeM3: doublePrecision("volume_m3").notNull(),
  massKg: doublePrecision("mass_kg").notNull(),
  co2Kg: doublePrecision("co2_kg").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("material_estimates_report_idx").on(table.reportId),
  index("material_estimates_material_idx").on(table.material),
]);

export const statusEvents = pgTable("status_events", {
  id: serial("id").primaryKey(),
  reportId: text("report_id").notNull().references(() => wasteReports.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  actorEmail: text("actor_email").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("status_events_report_idx").on(table.reportId),
  index("status_events_created_idx").on(table.createdAt),
]);

export const collectionAssignments = pgTable("collection_assignments", {
  id: serial("id").primaryKey(),
  reportId: text("report_id").notNull().references(() => wasteReports.id, { onDelete: "cascade" }),
  vehicleNumber: text("vehicle_number").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  driverName: text("driver_name").notNull(),
  driverContactMasked: text("driver_contact_masked"),
  recyclerDestination: text("recycler_destination").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  estimatedArrivalAt: timestamp("estimated_arrival_at", { withTimezone: true }),
  status: text("status").notNull().default("Scheduled"),
  assignedByEmail: text("assigned_by_email").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("collection_assignments_report_unique").on(table.reportId),
  index("collection_assignments_scheduled_idx").on(table.scheduledAt),
]);

export const recyclingReceipts = pgTable("recycling_receipts", {
  id: serial("id").primaryKey(),
  reportId: text("report_id").notNull().references(() => wasteReports.id, { onDelete: "cascade" }),
  recyclerEmail: text("recycler_email").notNull(),
  receivedMassKg: doublePrecision("received_mass_kg").notNull(),
  recoveredMassKg: doublePrecision("recovered_mass_kg").notNull(),
  rejectedMassKg: doublePrecision("rejected_mass_kg").notNull().default(0),
  certificateNumber: text("certificate_number"),
  evidenceObjectKey: text("evidence_object_key"),
  status: text("status").notNull().default("Draft"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("recycling_receipts_report_unique").on(table.reportId),
  index("recycling_receipts_recycler_idx").on(table.recyclerEmail),
]);

export const modelVersions = pgTable("model_versions", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  mode: text("mode").notNull(),
  confidenceThreshold: doublePrecision("confidence_threshold").notNull().default(0.7),
  configurationJson: text("configuration_json").notNull(),
  active: boolean("active").notNull().default(false),
  createdByEmail: text("created_by_email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("model_versions_active_idx").on(table.active)]);
