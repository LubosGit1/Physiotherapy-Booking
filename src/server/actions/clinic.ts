"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { createService, setServiceActive } from "@/server/services/catalog";
import { addTimeOff, deleteTimeOff } from "@/server/services/schedule";
import { formValue, runAction } from "./run-action";

/** `values` refill the form after a failed submit (React resets form fields after an action). */
export type FormState = { error?: string; success?: string; values?: Record<string, string | string[]> };

export async function createServiceAction(_: FormState, formData: FormData): Promise<FormState> {
  const values = {
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    durationMin: formValue(formData, "durationMin"),
    price: formValue(formData, "price"),
    therapistIds: formData.getAll("therapistIds").map(String),
  };
  const result = await runAction(({ viewer }) => createService(viewer, values));
  if (!result.ok) return { error: result.error, values };
  revalidatePath("/", "layout");
  return { success: `${result.data.name} is now bookable.` };
}

export async function setServiceActiveAction(serviceId: string, active: boolean): Promise<ActionResult> {
  const result = await runAction(async ({ viewer }) => void (await setServiceActive(viewer, serviceId, active)));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function addTimeOffAction(_: FormState, formData: FormData): Promise<FormState> {
  const values = { startsAt: formValue(formData, "startsAt"), endsAt: formValue(formData, "endsAt"), reason: formValue(formData, "reason") };
  const result = await runAction(({ viewer, now }) => addTimeOff(viewer, values, now));
  if (!result.ok) return { error: result.error, values };
  revalidatePath("/schedule");
  return { success: "Time off added. Those hours are no longer bookable." };
}

export async function deleteTimeOffAction(id: string): Promise<ActionResult> {
  const result = await runAction(({ viewer }) => deleteTimeOff(viewer, id));
  if (result.ok) revalidatePath("/schedule");
  return result;
}
