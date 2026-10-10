CREATE TYPE "public"."appointment_status" AS ENUM('HELD', 'CONFIRMED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('CLIENT', 'THERAPIST', 'ADMIN');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"therapist_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'HELD' NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_range_check" CHECK ("appointments"."starts_at" < "appointments"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"kind" text NOT NULL,
	"appointment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_min" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_duration_check" CHECK ("services"."duration_min" BETWEEN 15 AND 180 AND "services"."duration_min" % 15 = 0),
	CONSTRAINT "services_price_check" CHECK ("services"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "test_clock" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"now" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "therapist_services" (
	"therapist_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "therapist_services_therapist_id_service_id_pk" PRIMARY KEY("therapist_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "therapists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"bio" text,
	CONSTRAINT "therapists_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"therapist_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_off_range_check" CHECK ("time_off"."starts_at" < "time_off"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'CLIENT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "working_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"therapist_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	CONSTRAINT "working_hours_weekday_check" CHECK ("working_hours"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "working_hours_range_check" CHECK ("working_hours"."start_minute" >= 0 AND "working_hours"."end_minute" <= 1440 AND "working_hours"."start_minute" < "working_hours"."end_minute")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_therapist_id_therapists_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapist_services" ADD CONSTRAINT "therapist_services_therapist_id_therapists_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapist_services" ADD CONSTRAINT "therapist_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapists" ADD CONSTRAINT "therapists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_therapist_id_therapists_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_therapist_id_therapists_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_idempotency_idx" ON "appointments" USING btree ("client_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "appointments_therapist_start_idx" ON "appointments" USING btree ("therapist_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_client_start_idx" ON "appointments" USING btree ("client_id","starts_at");--> statement-breakpoint
CREATE INDEX "email_outbox_unsent_idx" ON "email_outbox" USING btree ("sent_at","created_at");--> statement-breakpoint
CREATE INDEX "time_off_therapist_idx" ON "time_off" USING btree ("therapist_id","starts_at");--> statement-breakpoint
CREATE INDEX "working_hours_therapist_idx" ON "working_hours" USING btree ("therapist_id","weekday");