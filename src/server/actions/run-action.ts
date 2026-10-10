import { AppError } from "@/lib/errors";
import type { ActionResult, Viewer } from "@/lib/types";
import { currentTime } from "@/server/clock";
import { getViewer } from "@/server/viewer";

/** Shared wrapper for server actions: resolves viewer and time, returns a predictable error shape. */
export async function runAction<T>(fn: (ctx: { viewer: Viewer | null; now: Date }) => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn({ viewer: await getViewer(), now: await currentTime() }) };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
  }
}

export const formValue = (formData: FormData, name: string) => String(formData.get(name) ?? "");
