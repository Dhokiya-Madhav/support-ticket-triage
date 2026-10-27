"use client";

import { useState, type ReactNode } from "react";

interface Position {
  x: number;
  y: number;
  below: boolean;
}

/**
 * Small label that appears on hover or keyboard focus. It is positioned against the screen, so
 * it is never clipped by a scrolling table or card. Wrap one control (e.g. an icon button).
 */
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const [position, setPosition] = useState<Position | null>(null);

  function show(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const below = rect.top < 40; // not enough room above: drop below instead
    setPosition({
      x: rect.left + rect.width / 2,
      y: below ? rect.bottom + 8 : rect.top - 8,
      below,
    });
  }

  return (
    <span
      className="inline-flex"
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPosition(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setPosition(null)}
    >
      {children}
      {position && (
        <span
          role="tooltip"
          style={{ left: position.x, top: position.y }}
          className={
            "pointer-events-none fixed z-[60] -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background shadow-lg " +
            (position.below ? "" : "-translate-y-full")
          }
        >
          {content}
        </span>
      )}
    </span>
  );
}
