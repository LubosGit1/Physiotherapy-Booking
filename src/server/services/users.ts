import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ConflictError } from "@/lib/errors";
import { loginSchema, parseInput, registerSchema } from "@/lib/validation";

const publicColumns = { id: users.id, name: users.name, email: users.email, role: users.role };

/** Self-service sign-up always creates a client; staff accounts are created by the clinic. */
export async function registerClient(input: unknown) {
  const data = parseInput(registerSchema, input);
  const existing = await db.query.users.findFirst({ where: eq(users.email, data.email) });
  if (existing) throw new ConflictError("An account with this email already exists. Sign in instead.");

  const [user] = await db
    .insert(users)
    .values({ name: data.name, email: data.email, passwordHash: await hash(data.password, 10), role: "CLIENT" })
    .returning(publicColumns);
  return user;
}

export async function verifyCredentials(input: unknown) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return null;
  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
  if (!user || !(await compare(parsed.data.password, user.passwordHash))) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
