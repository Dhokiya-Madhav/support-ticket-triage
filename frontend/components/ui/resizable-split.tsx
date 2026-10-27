"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { useLocalStorage } from "@/lib/use-local-storage";

const HANDLE_PX = 12;
const MIN_LEFT_PX = 360;
const KEY_STEP_PX = 24;

/**
 * Two panes with a draggable divider on wide screens (stacked on small ones). Give it a parent
 * with a fixed height: on wide screens the left pane then scrolls on its own and the right pane
 * fills the height (e.g. so comments can scroll separately).
 * The right pane's width is remembered. Drag the divider, use the arrow keys when it is
 * focused, or double-click it to go back to the default width.
 */
export function ResizableSplit({
  left,
  right,
  storageKey,
  defaultRight = 440,
  minRight = 320,
  maxRight = 760,
  className,
}: {
  left: ReactNode;
  right: ReactNode;
  storageKey: string;
  defaultRight?: number;
  minRight?: number;
  maxRight?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stored, setStored] = useLocalStorage(storageKey, String(defaultRight));
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const savedWidth = Number(stored) || defaultRight;
  const width = dragWidth ?? savedWidth;

  /** Keeps the right pane within its limits and leaves room for the left pane. */
  function clamp(value: number): number {
    const total = containerRef.current?.getBoundingClientRect().width ?? Infinity;
    const max = Math.max(minRight, Math.min(maxRight, total - MIN_LEFT_PX - HANDLE_PX));
    return Math.round(Math.min(Math.max(value, minRight), max));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragWidth(savedWidth);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragWidth === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDragWidth(clamp(rect.right - event.clientX - HANDLE_PX / 2));
  }

  function onPointerUp() {
    if (dragWidth === null) return;
    setStored(String(dragWidth));
    setDragWidth(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      // Moving the divider left makes the right pane wider.
      ArrowLeft: savedWidth + KEY_STEP_PX,
      ArrowRight: savedWidth - KEY_STEP_PX,
      Home: minRight,
      End: maxRight,
    };
    const next = steps[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setStored(String(clamp(next)));
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col gap-6 lg:flex-row lg:gap-0",
        dragWidth !== null && "cursor-col-resize select-none",
        className,
      )}
      style={{ "--right-w": `${width}px` } as CSSProperties}
    >
      <div className="min-w-0 flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2">{left}</div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        aria-valuemin={minRight}
        aria-valuemax={maxRight}
        aria-valuenow={width}
        tabIndex={0}
        title="Drag to resize. Double-click to reset."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onDoubleClick={() => setStored(String(defaultRight))}
        className="group hidden w-3 shrink-0 cursor-col-resize touch-none justify-center focus-visible:outline-none lg:flex"
      >
        <div
          className={cn(
            "my-1 w-px rounded-full bg-border transition-all group-hover:w-0.5 group-hover:bg-primary group-focus-visible:w-0.5 group-focus-visible:bg-primary",
            dragWidth !== null && "w-0.5 bg-primary",
          )}
        />
      </div>

      <div className="min-w-0 lg:min-h-0 lg:w-[var(--right-w)] lg:max-w-[calc(100%-23.25rem)] lg:shrink-0 lg:pl-1">
        {right}
      </div>
    </div>
  );
}
