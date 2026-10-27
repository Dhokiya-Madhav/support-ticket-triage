import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<ComponentProps<"input">, "type" | "className"> {
  label: ReactNode;
  hint?: string;
  className?: string;
}

export function Checkbox({ label, hint, className, ...props }: CheckboxProps) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-border accent-primary"
        {...props}
      />
      <span className="text-sm">
        <span className="font-medium text-foreground">{label}</span>
        {hint && <span className="block text-muted">{hint}</span>}
      </span>
    </label>
  );
}
