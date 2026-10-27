import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FormField, controlClasses, type FieldShellProps } from "./form-field";

export interface InputProps extends Omit<ComponentProps<"input">, "className">, FieldShellProps {
  /** Icon shown inside the left edge of the field. */
  icon?: ReactNode;
  inputClassName?: string;
}

export function Input({
  label,
  hint,
  error,
  className,
  inputClassName,
  icon,
  required,
  ...props
}: InputProps) {
  return (
    <FormField label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy }) => (
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
              {icon}
            </span>
          )}
          <input
            id={id}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(controlClasses(Boolean(error)), "h-10", icon ? "pl-9" : undefined, inputClassName)}
            {...props}
          />
        </div>
      )}
    </FormField>
  );
}
