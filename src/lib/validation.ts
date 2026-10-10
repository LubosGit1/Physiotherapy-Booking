import { z } from "zod";
import { ValidationError } from "./errors";
import { parsePrice } from "./money";
import { isValidDate } from "./time";

export const idSchema = z.uuid("Invalid id.");
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));
export const dateSchema = z.string().refine(isValidDate, "Use a date in the format YYYY-MM-DD.");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80, "That name is too long."),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Use at least 8 characters for your password.")
    .max(72, "Use at most 72 characters for your password."),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const availabilitySchema = z.object({
  serviceId: idSchema,
  therapistId: idSchema.optional(),
  date: dateSchema,
});

export const holdSchema = z.object({
  serviceId: idSchema,
  therapistId: idSchema,
  startsAt: z.iso.datetime({ offset: true, message: "Pick a time from the list." }).transform((v) => new Date(v)),
  idempotencyKey: z.string().min(8).max(64),
});

export const DURATIONS = [15, 30, 45, 60, 75, 90, 120] as const;

export const serviceSchema = z.object({
  name: z.string().trim().min(3, "Give the service a name.").max(60, "That name is too long."),
  description: z
    .string()
    .trim()
    .max(240, "Keep the description under 240 characters.")
    .optional()
    .transform((v) => v || null),
  durationMin: z.coerce
    .number()
    .refine((v) => (DURATIONS as readonly number[]).includes(v), "Pick one of the listed durations."),
  price: z
    .string()
    .transform((v, ctx) => {
      const cents = parsePrice(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Enter a price in euros, for example 45 or 45.50." });
        return z.NEVER;
      }
      return cents;
    }),
  therapistIds: z.array(idSchema).min(1, "Choose at least one therapist who offers it."),
});

export const timeOffSchema = z.object({
  startsAt: z.string().min(1, "Choose when the time off starts."),
  endsAt: z.string().min(1, "Choose when the time off ends."),
  reason: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || null),
});

/** Parse untrusted input or throw a ValidationError with the first readable message. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? "Check the details and try again.");
  return result.data;
}

export const isUuid = (value: unknown) => idSchema.safeParse(value).success;
