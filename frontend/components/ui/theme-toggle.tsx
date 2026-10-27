"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

const subscribe = (callback: () => void) => {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
const isDark = () => document.documentElement.classList.contains("dark");

export function ThemeToggle({
  className,
  showLabel = false,
  fullWidth = false,
}: {
  className?: string;
  /** Show "Dark mode" / "Light mode" text next to the icon (used in the sidebar). */
  showLabel?: boolean;
  /** Stretch to the width of the container (icon centered when there is no label). */
  fullWidth?: boolean;
}) {
  // The <html> class is set by an inline script before paint; read it rather than duplicating state.
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* private mode: the choice just won't persist */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex items-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground",
        showLabel
          ? "h-10 w-full gap-2.5 px-3 text-sm font-medium"
          : fullWidth
            ? "h-10 w-full justify-center"
            : "size-9 justify-center",
        className,
      )}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      {showLabel && (dark ? "Light mode" : "Dark mode")}
    </button>
  );
}
