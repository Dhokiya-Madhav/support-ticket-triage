import { cn } from "@/lib/cn";

const sizes = { sm: "size-4 border-2", md: "size-6 border-2", lg: "size-9 border-[3px]" };

export function Spinner({
  size = "md",
  className,
  label = "Loading",
}: {
  size?: keyof typeof sizes;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block animate-spin rounded-full border-current border-t-transparent",
        sizes[size],
        className,
      )}
    />
  );
}

/** Centered spinner for whole-page or section loading states. */
export function PageSpinner() {
  return (
    <div className="flex min-h-48 items-center justify-center text-muted">
      <Spinner size="lg" />
    </div>
  );
}
