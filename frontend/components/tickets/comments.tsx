"use client";

import { FileText, MessagesSquare, Paperclip, Send, X } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Badge, Button, EmptyState } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { attachmentUrl } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatBytes, formatDateTime, formatRelative } from "@/lib/format";
import type { Attachment } from "@/lib/types";

export interface CommentLike {
  id: number;
  body_text: string;
  created_at: string;
  attachments: Attachment[];
}

/* ------------------------------------------------------------------ button */

/** Header button that opens the comments sidebar. The dot flags something waiting (e.g. an AI suggestion). */
export function CommentsButton({
  count,
  open,
  onClick,
  indicator = false,
}: {
  count: number;
  open: boolean;
  onClick: () => void;
  indicator?: boolean;
}) {
  return (
    <Button
      variant={open ? "primary" : "secondary"}
      icon={<MessagesSquare className="size-4" />}
      onClick={onClick}
      aria-expanded={open}
      aria-controls="comments-drawer"
      className="relative"
    >
      Comments
      <span className="rounded-full bg-black/10 px-1.5 text-xs tabular-nums dark:bg-white/15">
        {count}
      </span>
      {indicator && (
        <span
          aria-label="AI suggestion available"
          className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-background bg-amber-400"
        />
      )}
    </Button>
  );
}

/* ------------------------------------------------------------------ drawer */

/**
 * Right-hand sidebar for the comments. It slides in over the page, dims what is behind it, and
 * closes on Esc, the X, or a click outside. The thread scrolls; the footer (comment box) stays
 * fixed at the bottom. It stays mounted when closed so a half-written comment is not lost.
 */
export function CommentsDrawer({
  open,
  onClose,
  count,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  subtitle?: string;
  /** The thread. */
  children: ReactNode;
  /** The comment box, or a notice explaining why commenting is unavailable. */
  footer: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Jump to the newest comment when the drawer opens or a comment arrives.
  useEffect(() => {
    const el = scrollRef.current;
    if (open && el) el.scrollTop = el.scrollHeight;
  }, [open, count]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        />
      )}
      <aside
        id="comments-drawer"
        role="complementary"
        aria-label="Comments"
        inert={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-surface shadow-xl sm:w-[30rem]",
          "transition-[transform,visibility] duration-300 ease-out",
          open ? "translate-x-0" : "invisible translate-x-full",
        )}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <MessagesSquare className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              Comments
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted tabular-nums">
                {count}
              </span>
            </h2>
            {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </header>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>
        {footer}
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ thread */

function initials(name: string): string {
  const parts = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/** Comments in time order with day separators. */
export function CommentThread<C extends CommentLike>({
  comments,
  author,
  role,
  isMine,
}: {
  comments: C[];
  /** Name shown above each comment. */
  author: (comment: C) => string;
  /** Label next to the name, e.g. "Support". */
  role?: (comment: C) => { label: string; tone: BadgeTone } | null;
  /** Your own comments get a tinted bubble. */
  isMine?: (comment: C) => boolean;
}) {
  if (comments.length === 0) {
    return (
      <EmptyState
        icon={<MessagesSquare className="size-6" />}
        title="No comments yet"
        description="Comments on this ticket appear here. Everyone on the ticket can see them."
        className="py-16"
      />
    );
  }

  let lastDay = "";
  return (
    <ol className="flex flex-col gap-5">
      {comments.map((comment) => {
        const day = new Date(comment.created_at).toDateString();
        const showDay = day !== lastDay;
        lastDay = day;
        const name = author(comment);
        const tag = role?.(comment);
        const mine = isMine?.(comment) ?? false;
        const support = tag?.tone === "info";
        return (
          <li key={comment.id} className="flex flex-col gap-5">
            {showDay && (
              <div className="flex items-center gap-3 text-xs font-medium text-muted">
                <span className="h-px flex-1 bg-border" />
                {dayLabel(comment.created_at)}
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <article className="flex gap-3">
              <span
                aria-hidden
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  support
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-muted text-foreground ring-1 ring-border",
                )}
              >
                {initials(name)}
              </span>
              <div className="min-w-0 flex-1">
                <header className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-foreground">{name}</span>
                  {tag && <Badge tone={tag.tone}>{tag.label}</Badge>}
                  <time
                    dateTime={comment.created_at}
                    title={formatDateTime(comment.created_at)}
                    className="text-xs text-muted"
                  >
                    {formatRelative(comment.created_at)}
                  </time>
                </header>
                <div
                  className={cn(
                    "mt-1.5 rounded-2xl rounded-tl-md border px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground",
                    mine
                      ? "border-transparent bg-primary-soft"
                      : "border-border bg-surface-muted/60",
                  )}
                >
                  {comment.body_text}
                </div>
                {comment.attachments.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {comment.attachments.map((file) => (
                      <li key={file.id}>
                        <a
                          href={attachmentUrl(file.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                            <FileText className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-foreground">
                              {file.filename}
                            </span>
                            <span className="block text-xs text-muted">
                              {formatBytes(file.size)}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------------------------------------------------------- composer */

/** Comment box docked at the bottom of the drawer. Grows with the text; Ctrl+Enter posts. */
export function CommentComposer({
  value,
  onChange,
  onSubmit,
  submitting = false,
  disabled = false,
  error,
  placeholder = "Write a comment…",
  submitLabel = "Post",
  header,
  files,
  onFilesChange,
  accept,
  maxFiles = 5,
  maxSizeMb = 20,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  /** Blocks posting while another action is running. */
  disabled?: boolean;
  error?: string | null;
  placeholder?: string;
  submitLabel?: string;
  /** Content above the box, e.g. the AI suggestion. */
  header?: ReactNode;
  /** Pass `files` and `onFilesChange` to allow attachments. */
  files?: File[];
  onFilesChange?: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSizeMb?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const list = files ?? [];
  const limit = maxSizeMb * 1024 * 1024;
  const oversize = list.find((f) => f.size > limit);
  const canPost = value.trim().length > 0 && !oversize && !submitting && !disabled;

  // Grow with the text, up to a cap, then scroll inside the box.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.35)}px`;
  }, [value]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && canPost) {
      event.preventDefault();
      onSubmit();
    }
  }

  function addFiles(picked: FileList | null) {
    if (!picked || !onFilesChange) return;
    onFilesChange([...list, ...Array.from(picked)].slice(0, maxFiles));
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface px-5 pt-4 pb-5">
      {header && <div className="mb-3">{header}</div>}
      {(error || oversize) && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {error ?? `${oversize?.name} is larger than ${maxSizeMb} MB.`}
        </p>
      )}

      <div className="rounded-2xl border border-border bg-background shadow-sm transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
        <textarea
          ref={textareaRef}
          rows={2}
          value={value}
          maxLength={10_000}
          placeholder={placeholder}
          aria-label="Comment"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="block max-h-[35vh] min-h-16 w-full resize-none bg-transparent px-4 pt-3 text-sm text-foreground placeholder:text-muted/80 focus:outline-none"
        />

        {list.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 px-3 pb-2">
            {list.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex max-w-full items-center gap-1.5 rounded-full bg-surface-muted py-1 pr-1 pl-3 text-xs"
              >
                <span className="truncate">{file.name}</span>
                <span className={cn("shrink-0 text-muted", file.size > limit && "text-danger")}>
                  {formatBytes(file.size)}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onFilesChange?.(list.filter((_, i) => i !== index))}
                  className="rounded-full p-1 text-muted hover:bg-border hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex items-center">
            {onFilesChange && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept={accept}
                  className="sr-only"
                  tabIndex={-1}
                  disabled={list.length >= maxFiles}
                  onChange={(e) => addFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={list.length >= maxFiles}
                  aria-label="Attach files"
                  title={list.length >= maxFiles ? `Maximum of ${maxFiles} files` : "Attach files"}
                  className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                >
                  <Paperclip className="size-[18px]" aria-hidden />
                </button>
              </>
            )}
            <span className="ml-1 hidden text-xs text-muted sm:inline">Ctrl+Enter to post</span>
          </div>
          <Button
            size="sm"
            icon={<Send className="size-4" />}
            loading={submitting}
            disabled={!canPost}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Shown in the drawer footer when the person can't comment right now. */
export function CommentsNotice({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-border bg-surface-muted/60 px-5 py-4 text-sm text-muted">
      {children}
    </div>
  );
}
