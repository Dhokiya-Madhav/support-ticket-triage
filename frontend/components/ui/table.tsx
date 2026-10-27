import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * The table scrolls inside its own box (both ways), so the page itself never has to scroll for it.
 * Size the box with `containerClassName` (e.g. a max height, or flex-1 inside a fixed-height page).
 * Header cells stay pinned while the rows scroll.
 */
export function Table({
  className,
  containerClassName,
  ...props
}: ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div className={cn("overflow-auto", containerClassName)}>
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}

export function THead(props: ComponentProps<"thead">) {
  return <thead {...props} />;
}

export function TBody(props: ComponentProps<"tbody">) {
  return <tbody className="divide-y divide-border" {...props} />;
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "sticky top-0 z-10 bg-surface-muted px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase shadow-[inset_0_-1px_0_var(--border)]",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-surface-muted/60", className)} {...props} />;
}
