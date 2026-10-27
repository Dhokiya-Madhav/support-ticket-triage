import type { Category, Sentiment, Urgency } from "./types";

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));

/** "5 minutes ago", "in 2 hours". */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(seconds, "second");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatHours(hours: number | null): string {
  if (hours === null) return "–";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1)} h`;
}

/** "feature_request" -> "Feature request". */
export const titleCase = (value: string) => {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const CATEGORIES: Category[] = [
  "billing",
  "refund",
  "login",
  "account",
  "bug",
  "integration",
  "feature_request",
  "cancellation",
  "general",
];
export const URGENCIES: Urgency[] = ["high", "medium", "low"];
export const SENTIMENTS: Sentiment[] = ["calm", "confused", "angry"];
