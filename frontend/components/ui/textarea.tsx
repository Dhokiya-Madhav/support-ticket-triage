import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { FormField, controlClasses, type FieldShellProps } from "./form-field";

export interface TextareaProps
  extends Omit<ComponentProps<"textarea">, "className">,
    FieldShellProps {
  textareaClassName?: string;
}

export function Textarea({
  label,
  hint,
  error,
  className,
  textareaClassName,
  required,
  rows = 5,
  ...props
}: TextareaProps) {
  return (
    <FormField label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          rows={rows}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(controlClasses(Boolean(error)), "resize-y py-2.5", textareaClassName)}
          {...props}
        />
      )}
    </FormField>
  );
}
