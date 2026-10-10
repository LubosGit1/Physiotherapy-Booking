-- Hand-written migration: Drizzle can't express exclusion constraints in the schema.
-- The database itself refuses two active (HELD or CONFIRMED) appointments that overlap
-- for the same therapist, so a race between two requests can never double-book.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "therapist_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" IN ('HELD', 'CONFIRMED'));
