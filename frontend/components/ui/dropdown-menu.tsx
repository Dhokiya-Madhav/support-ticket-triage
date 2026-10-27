"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

/** A button that opens a small menu of actions. Closes on outside click and Escape. */
export function DropdownMenu({
  trigger,
  items,
  header,
  align = "right",
  direction = "down",
  className,
  triggerClassName,
  label,
}: {
  trigger: ReactNode;
  items: MenuItem[];
  header?: ReactNode;
  align?: "left" | "right";
  /** Open below the button (default) or above it, e.g. for menus at the bottom of the sidebar. */
  direction?: "down" | "up";
  className?: string;
  triggerClassName?: string;
  /** Accessible name for the trigger button. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn("flex items-center rounded-lg p-1 hover:bg-surface-muted", triggerClassName)}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-30 w-56 rounded-xl border border-border bg-surface py-1 shadow-lg",
            direction === "down" ? "mt-2" : "bottom-full mb-2",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {header && <div className="border-b border-border px-4 py-2.5">{header}</div>}
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-surface-muted",
                item.danger ? "text-danger" : "text-foreground",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
