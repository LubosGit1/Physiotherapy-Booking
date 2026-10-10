import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-pine text-pine-ink hover:brightness-110",
  secondary: "border border-line bg-card text-ink hover:border-ink/40",
  ghost: "text-ink underline-offset-4 hover:underline",
  danger: "border border-danger/50 text-danger hover:bg-danger/10",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${VARIANTS[variant]} ${extra}`;
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-ink placeholder:text-muted/70 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/25";

/** Label, input and hint. The hint sits outside the label so it describes the field instead of renaming it. */
export function Field({ label, hint, id, ...props }: ComponentProps<"input"> & { label: string; hint?: string }) {
  const inputId = id ?? `field-${props.name}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block font-semibold">
        {label}
      </label>
      <input id={inputId} className={inputClass} aria-describedby={hintId} {...props} />
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-danger">
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-lg bg-mint px-3 py-2 font-medium text-ink">
      {message}
    </p>
  );
}

export function PageTitle({ children, lead }: { children: ReactNode; lead?: ReactNode }) {
  return (
    <div className="mb-8 max-w-2xl space-y-2">
      <h1 className="text-4xl font-extrabold sm:text-5xl">{children}</h1>
      {lead && <p className="text-lg text-muted">{lead}</p>}
    </div>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-baseline gap-1.5 text-xl font-extrabold tracking-tight">
      motion
      <span className="text-sm font-medium text-muted">physiotherapy</span>
    </span>
  );
}
