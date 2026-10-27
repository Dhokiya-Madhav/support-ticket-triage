import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { FormField, controlClasses, type FieldShellProps } from "./form-field";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<ComponentProps<"select">, "className">, FieldShellProps {
  options: SelectOption[];
  /** Adds a leading empty option, e.g. "All categories". */
  placeholder?: string;
  selectClassName?: string;
}

/** Native <select> styled to match the other fields, so keyboard and mobile behaviour stay correct. */
export function Select({
  label,
  hint,
  error,
  className,
  selectClassName,
  options,
  placeholder,
  required,
  ...props
}: SelectProps) {
  return (
    <FormField label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy }) => (
        <div className="relative">
          <select
            id={id}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              controlClasses(Boolean(error)),
              "h-10 cursor-pointer appearance-none pr-9",
              selectClassName,
            )}
            {...props}
          >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
        </div>
      )}
    </FormField>
  );
}
