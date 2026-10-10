import type { Role } from "./access";

export type Viewer = { id: string; role: Role; name: string; email: string };

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export type Slot = { startsAt: string; therapistId: string; therapistName: string };
