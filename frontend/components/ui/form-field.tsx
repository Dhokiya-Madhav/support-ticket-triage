import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

/** Shared label / hint / error wrapper. `children` receives the ids to wire up for accessibility. */
export function FormField({
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldShellProps & {
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {children({ id, describedBy })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const controlClasses = (invalid: boolean) =>
  cn(
    "w-full rounded-lg border bg-surface px-3 text-sm text-foreground shadow-sm transition-colors",
    "placeholder:text-muted/70 disabled:cursor-not-allowed disabled:opacity-60",
    "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
    invalid ? "border-danger" : "border-border",
  );
