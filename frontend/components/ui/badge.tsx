import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { titleCase } from "@/lib/format";
import type { Category, Sentiment, TicketStatus, Urgency } from "@/lib/types";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "purple";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-300",
  purple: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Ready-made badges so every screen colors the same value the same way.
const statusTone: Record<TicketStatus, BadgeTone> = { open: "info", resolved: "success" };
const urgencyTone: Record<Urgency, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };
const sentimentTone: Record<Sentiment, BadgeTone> = { angry: "danger", confused: "warning", calm: "success" };

export const StatusBadge = ({ status }: { status: TicketStatus }) => (
  <Badge tone={statusTone[status]}>{titleCase(status)}</Badge>
);
export const UrgencyBadge = ({ urgency }: { urgency: Urgency | null }) =>
  urgency ? <Badge tone={urgencyTone[urgency]}>{titleCase(urgency)}</Badge> : <Badge>Untriaged</Badge>;
export const SentimentBadge = ({ sentiment }: { sentiment: Sentiment | null }) =>
  sentiment ? <Badge tone={sentimentTone[sentiment]}>{titleCase(sentiment)}</Badge> : null;
export const CategoryBadge = ({ category }: { category: Category | null }) =>
  category ? <Badge tone="purple">{titleCase(category)}</Badge> : <Badge>Untriaged</Badge>;
