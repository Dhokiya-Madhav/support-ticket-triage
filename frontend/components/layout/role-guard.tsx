"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { PageSpinner } from "@/components/ui";
import { homeFor, useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

/** Sends people who open another role's page back to their own home. The API enforces access too. */
export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = user ? roles.includes(user.role) : false;

  useEffect(() => {
    if (user && !allowed) router.replace(homeFor(user.role));
  }, [user, allowed, router]);

  return allowed ? <>{children}</> : <PageSpinner />;
}
