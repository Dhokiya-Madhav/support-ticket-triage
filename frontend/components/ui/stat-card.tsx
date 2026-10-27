import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./card";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const iconTone = {
    default: "bg-primary-soft text-primary",
    danger: "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  }[tone];
  return (
    <Card className="flex items-start justify-between gap-3 p-5">
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      {icon && (
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", iconTone)}>
          {icon}
        </div>
      )}
    </Card>
  );
}
