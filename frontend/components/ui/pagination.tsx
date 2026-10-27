import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { Button } from "./button";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Page controls. Pass `onPageSizeChange` to add a "Rows per page" dropdown; the controls stay
 * visible while there is more than the smallest page size so the size can still be changed.
 */
export function Pagination({
  total,
  limit,
  offset,
  onChange,
  pageSizes = PAGE_SIZE_OPTIONS,
  onPageSizeChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
  pageSizes?: number[];
  onPageSizeChange?: (size: number) => void;
}) {
  const selectId = useId();
  const smallest = Math.min(...pageSizes);
  const hasPages = total > limit;
  const hasSizePicker = Boolean(onPageSizeChange) && total > smallest;
  if (!hasPages && !hasSizePicker) return null;

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-1 pt-4 text-sm text-muted">
      {hasSizePicker && onPageSizeChange ? (
        <div className="flex items-center gap-2">
          <label htmlFor={selectId}>Rows per page</label>
          <select
            id={selectId}
            value={limit}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 cursor-pointer rounded-lg border border-border bg-surface px-2 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-4">
        <span>
          {from}–{to} of {total}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<ChevronLeft className="size-4" />}
            disabled={offset === 0}
            onClick={() => onChange(Math.max(0, offset - limit))}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={offset + limit >= total}
            onClick={() => onChange(offset + limit)}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
