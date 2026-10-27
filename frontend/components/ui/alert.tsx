import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AlertTone = "error" | "success" | "info" | "warning";

const styles: Record<AlertTone, { box: string; icon: typeof Info }> = {
  error: {
    box: "border-red-200 bg-red-50 text-red-900 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200",
    icon: AlertCircle,
  },
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200",
    icon: CheckCircle2,
  },
  info: {
    box: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200",
    icon: Info,
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200",
    icon: TriangleAlert,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = styles[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}
