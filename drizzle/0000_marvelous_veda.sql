CREATE TABLE "collection_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"vehicle_number" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"driver_name" text NOT NULL,
	"driver_contact_masked" text,
	"recycler_destination" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"estimated_arrival_at" timestamp with time zone,
	"status" text DEFAULT 'Scheduled' NOT NULL,
	"assigned_by_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_estimates" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"material" text NOT NULL,
	"probability" double precision NOT NULL,
	"area_m2" double precision NOT NULL,
	"volume_m3" double precision NOT NULL,
	"mass_kg" double precision NOT NULL,
	"co2_kg" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"mode" text NOT NULL,
	"confidence_threshold" double precision DEFAULT 0.7 NOT NULL,
	"configuration_json" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_by_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recycling_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"recycler_email" text NOT NULL,
	"received_mass_kg" double precision NOT NULL,
	"recovered_mass_kg" double precision NOT NULL,
	"rejected_mass_kg" double precision DEFAULT 0 NOT NULL,
	"certificate_number" text,
	"evidence_object_key" text,
	"status" text DEFAULT 'Draft' NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"status" text NOT NULL,
	"actor_email" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'generator' NOT NULL,
	"organization" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waste_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_email" text NOT NULL,
	"site_name" text NOT NULL,
	"ward" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"camera_height_m" double precision NOT NULL,
	"horizontal_fov_deg" double precision NOT NULL,
	"image_object_key" text,
	"analysis_id" text NOT NULL,
	"analysis_mode" text DEFAULT 'prototype' NOT NULL,
	"model_version" text DEFAULT 'prototype-0.1' NOT NULL,
	"dominant_material" text NOT NULL,
	"confidence" double precision NOT NULL,
	"manual_review_required" boolean DEFAULT true NOT NULL,
	"total_area_m2" double precision NOT NULL,
	"total_volume_m3" double precision NOT NULL,
	"total_mass_kg" double precision NOT NULL,
	"total_co2_kg" double precision NOT NULL,
	"status" text DEFAULT 'Submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_assignments" ADD CONSTRAINT "collection_assignments_report_id_waste_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."waste_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_estimates" ADD CONSTRAINT "material_estimates_report_id_waste_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."waste_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recycling_receipts" ADD CONSTRAINT "recycling_receipts_report_id_waste_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."waste_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_events" ADD CONSTRAINT "status_events_report_id_waste_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."waste_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_assignments_report_unique" ON "collection_assignments" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "collection_assignments_scheduled_idx" ON "collection_assignments" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "material_estimates_report_idx" ON "material_estimates" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "material_estimates_material_idx" ON "material_estimates" USING btree ("material");--> statement-breakpoint
CREATE INDEX "model_versions_active_idx" ON "model_versions" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "recycling_receipts_report_unique" ON "recycling_receipts" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "recycling_receipts_recycler_idx" ON "recycling_receipts" USING btree ("recycler_email");--> statement-breakpoint
CREATE INDEX "status_events_report_idx" ON "status_events" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "status_events_created_idx" ON "status_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "waste_reports_owner_idx" ON "waste_reports" USING btree ("owner_email");--> statement-breakpoint
CREATE INDEX "waste_reports_status_idx" ON "waste_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "waste_reports_created_idx" ON "waste_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "waste_reports_ward_idx" ON "waste_reports" USING btree ("ward");