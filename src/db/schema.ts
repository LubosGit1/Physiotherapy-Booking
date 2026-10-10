import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["CLIENT", "THERAPIST", "ADMIN"]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "HELD",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
]);

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => timestamptz("created_at").defaultNow().notNull();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").default("CLIENT").notNull(),
  createdAt: createdAt(),
});

export const therapists = pgTable("therapists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  bio: text("bio"),
});

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    durationMin: integer("duration_min").notNull(),
    priceCents: integer("price_cents").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("services_duration_check", sql`${t.durationMin} BETWEEN 15 AND 180 AND ${t.durationMin} % 15 = 0`),
    check("services_price_check", sql`${t.priceCents} >= 0`),
  ],
);

export const therapistServices = pgTable(
  "therapist_services",
  {
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => therapists.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.therapistId, t.serviceId] })],
);

/** Weekly opening hours in clinic-local time. weekday: 1 = Monday … 7 = Sunday. */
export const workingHours = pgTable(
  "working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => therapists.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => [
    index("working_hours_therapist_idx").on(t.therapistId, t.weekday),
    check("working_hours_weekday_check", sql`${t.weekday} BETWEEN 1 AND 7`),
    check(
      "working_hours_range_check",
      sql`${t.startMinute} >= 0 AND ${t.endMinute} <= 1440 AND ${t.startMinute} < ${t.endMinute}`,
    ),
  ],
);

export const timeOff = pgTable(
  "time_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => therapists.id, { onDelete: "cascade" }),
    startsAt: timestamptz("starts_at").notNull(),
    endsAt: timestamptz("ends_at").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [
    index("time_off_therapist_idx").on(t.therapistId, t.startsAt),
    check("time_off_range_check", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

/**
 * A HELD appointment reserves the slot for a few minutes while the client confirms.
 * An exclusion constraint (see drizzle/0001_booking_constraints.sql) makes overlapping
 * HELD/CONFIRMED appointments for one therapist impossible at the database level.
 */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => therapists.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    startsAt: timestamptz("starts_at").notNull(),
    endsAt: timestamptz("ends_at").notNull(),
    status: appointmentStatusEnum("status").default("HELD").notNull(),
    holdExpiresAt: timestamptz("hold_expires_at"),
    idempotencyKey: text("idempotency_key").notNull(),
    confirmedAt: timestamptz("confirmed_at"),
    cancelledAt: timestamptz("cancelled_at"),
    cancelledById: uuid("cancelled_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("appointments_idempotency_idx").on(t.clientId, t.idempotencyKey),
    index("appointments_therapist_start_idx").on(t.therapistId, t.startsAt),
    index("appointments_client_start_idx").on(t.clientId, t.startsAt),
    check("appointments_range_check", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

/** Transactional outbox: rows are written in the same transaction as the booking change. */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    kind: text("kind").notNull(),
    appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    sentAt: timestamptz("sent_at"),
  },
  (t) => [index("email_outbox_unsent_idx").on(t.sentAt, t.createdAt)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamptz("window_start").notNull(),
  count: integer("count").notNull(),
});

/** Only read when E2E_TEST_MODE=1 – lets end-to-end tests freeze and move server time. */
export const testClock = pgTable("test_clock", {
  id: integer("id").primaryKey().default(1),
  now: timestamptz("now").notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  therapist: one(therapists, { fields: [users.id], references: [therapists.userId] }),
  appointments: many(appointments),
}));

export const therapistsRelations = relations(therapists, ({ one, many }) => ({
  user: one(users, { fields: [therapists.userId], references: [users.id] }),
  services: many(therapistServices),
  workingHours: many(workingHours),
  timeOff: many(timeOff),
  appointments: many(appointments),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  therapists: many(therapistServices),
}));

export const therapistServicesRelations = relations(therapistServices, ({ one }) => ({
  therapist: one(therapists, { fields: [therapistServices.therapistId], references: [therapists.id] }),
  service: one(services, { fields: [therapistServices.serviceId], references: [services.id] }),
}));

export const workingHoursRelations = relations(workingHours, ({ one }) => ({
  therapist: one(therapists, { fields: [workingHours.therapistId], references: [therapists.id] }),
}));

export const timeOffRelations = relations(timeOff, ({ one }) => ({
  therapist: one(therapists, { fields: [timeOff.therapistId], references: [therapists.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  client: one(users, { fields: [appointments.clientId], references: [users.id] }),
  therapist: one(therapists, { fields: [appointments.therapistId], references: [therapists.id] }),
  service: one(services, { fields: [appointments.serviceId], references: [services.id] }),
}));
