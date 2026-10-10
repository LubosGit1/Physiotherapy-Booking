/** Domain errors carry an HTTP status so route handlers and server actions map them the same way. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Sign in to continue.") {
    super(message, 401);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You don't have access to that.") {
    super(message, 403);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(message, 404);
  }
}
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
export class GoneError extends AppError {
  constructor(message: string) {
    super(message, 410);
  }
}
export class RateLimitError extends AppError {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(message, 429);
  }
}

export function toHttpError(error: unknown): { status: number; message: string } {
  if (error instanceof AppError) return { status: error.status, message: error.message };
  return { status: 500, message: "Something went wrong on our side. Try again in a moment." };
}

/** Postgres error code, also when the driver error is wrapped by Drizzle. */
export function pgErrorCode(error: unknown): string | undefined {
  for (let current = error; current && typeof current === "object"; current = (current as { cause?: unknown }).cause) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}
