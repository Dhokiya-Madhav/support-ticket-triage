"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Buttons shown in the bottom bar. */
  footer?: ReactNode;
  className?: string;
}

/** Built on the native <dialog>, which provides focus trapping, Esc to close, and a backdrop. */
export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-surface p-0 text-foreground shadow-xl",
        "backdrop:bg-black/50 backdrop:backdrop-blur-[2px]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
      )}
    </dialog>
  );
}
