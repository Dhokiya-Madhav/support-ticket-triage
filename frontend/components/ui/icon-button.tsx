import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";
import { Tooltip } from "./tooltip";

export type IconButtonTone = "default" | "danger";

const tones: Record<IconButtonTone, string> = {
  default: "text-muted hover:bg-surface-muted hover:text-foreground",
  danger: "text-danger hover:bg-danger/10",
};

export interface IconButtonProps extends Omit<ComponentProps<"button">, "children" | "title"> {
  /** Names the action: shown as a tooltip on hover/focus and read out by screen readers. */
  label: string;
  icon: ReactNode;
  tone?: IconButtonTone;
  loading?: boolean;
}

/** Icon-only button with a tooltip, for compact places such as table action columns. */
export function IconButton({
  label,
  icon,
  tone = "default",
  loading = false,
  disabled,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={label}>
      <button
        type={type}
        aria-label={label}
        disabled={disabled || loading}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50",
          tones[tone],
          className,
        )}
        {...props}
      >
        {loading ? <Spinner size="sm" /> : icon}
      </button>
    </Tooltip>
  );
}
