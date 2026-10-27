"use client";

import { Paperclip, X } from "lucide-react";
import { useId, useRef } from "react";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";

export interface FileInputProps {
  label?: string;
  hint?: string;
  error?: string;
  files: File[];
  onChange: (files: File[]) => void;
  /** e.g. ".png,.pdf" */
  accept?: string;
  maxFiles?: number;
  maxSizeMb?: number;
  disabled?: boolean;
  className?: string;
}

export function FileInput({
  label,
  hint,
  error,
  files,
  onChange,
  accept,
  maxFiles = 5,
  maxSizeMb = 20,
  disabled,
  className,
}: FileInputProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    onChange([...files, ...Array.from(list)].slice(0, maxFiles));
    if (inputRef.current) inputRef.current.value = ""; // allow picking the same file again
  }

  const tooBig = (file: File) => file.size > maxSizeMb * 1024 * 1024;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted transition-colors hover:bg-surface-muted",
          error ? "border-danger" : "border-border",
          (disabled || files.length >= maxFiles) && "pointer-events-none opacity-60",
        )}
      >
        <Paperclip className="size-4" aria-hidden />
        {files.length >= maxFiles ? `Maximum of ${maxFiles} files` : "Click to attach files"}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple
        accept={accept}
        disabled={disabled || files.length >= maxFiles}
        onChange={(event) => addFiles(event.target.files)}
        className="sr-only"
      />
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {file.name}{" "}
                <span className={cn("text-muted", tooBig(file) && "text-danger")}>
                  ({formatBytes(file.size)}
                  {tooBig(file) && ` – over ${maxSizeMb} MB`})
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="shrink-0 rounded p-1 text-muted hover:bg-border hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
