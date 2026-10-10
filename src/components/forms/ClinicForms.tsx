"use client";

import { useActionState, useTransition } from "react";
import { Button, Field, FormError, FormSuccess, inputClass } from "@/components/ui";
import { DURATIONS } from "@/lib/validation";
import {
  addTimeOffAction,
  createServiceAction,
  deleteTimeOffAction,
  setServiceActiveAction,
  type FormState,
} from "@/server/actions/clinic";

const valueOf = (state: FormState) => (name: string) => {
  const value = state.values?.[name];
  return typeof value === "string" ? value : undefined;
};

export function TimeOffForm() {
  const [state, action, pending] = useActionState(addTimeOffAction, {});
  const value = valueOf(state);
  return (
    <form action={action} className="space-y-4" data-cy="time-off-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" name="startsAt" type="datetime-local" required defaultValue={value("startsAt")} />
        <Field label="Until" name="endsAt" type="datetime-local" required defaultValue={value("endsAt")} />
      </div>
      <Field label="Reason (only staff see it)" name="reason" maxLength={120} placeholder="Training course" defaultValue={value("reason")} />
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add time off"}
      </Button>
    </form>
  );
}

export function DeleteTimeOffButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="ghost" disabled={pending} onClick={() => startTransition(async () => void (await deleteTimeOffAction(id)))}>
      {pending ? "Removing…" : "Remove"}
    </Button>
  );
}

export function NewServiceForm({ therapists }: { therapists: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createServiceAction, {});
  const value = valueOf(state);
  const chosen = new Set(state.values?.therapistIds ?? []);
  return (
    <form action={action} className="space-y-4" data-cy="new-service-form" noValidate>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Name" name="name" placeholder="Dry needling" defaultValue={value("name")} />
        <label className="block space-y-1.5">
          <span className="font-semibold">Length</span>
          <select name="durationMin" defaultValue={value("durationMin") ?? "45"} key={value("durationMin")} className={inputClass}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
        </label>
        <Field label="Price in €" name="price" inputMode="decimal" placeholder="45" defaultValue={value("price")} />
      </div>
      <Field label="Short description" name="description" maxLength={240} defaultValue={value("description")} />
      <fieldset className="space-y-2">
        <legend className="font-semibold">Who offers it</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {therapists.map((t) => (
            <label key={t.id} className="flex items-center gap-2">
              <input type="checkbox" name="therapistIds" value={t.id} defaultChecked={chosen.has(t.id)} className="size-4 accent-pine" />
              {t.name}
            </label>
          ))}
        </div>
      </fieldset>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add service"}
      </Button>
    </form>
  );
}

export function ServiceActiveToggle({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      aria-label={`${active ? "Stop offering" : "Offer"} ${name}`}
      onClick={() => startTransition(async () => void (await setServiceActiveAction(id, !active)))}
    >
      {active ? "Stop offering" : "Offer again"}
    </Button>
  );
}
