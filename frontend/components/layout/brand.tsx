import { LifeBuoy } from "lucide-react";
import Link from "next/link";

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link
      href={href}
      aria-label="Support Desk"
      className="flex items-center gap-2.5 font-semibold text-foreground"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <LifeBuoy className="size-5" aria-hidden />
      </span>
      {!compact && <span className="whitespace-nowrap">Support Desk</span>}
    </Link>
  );
}
