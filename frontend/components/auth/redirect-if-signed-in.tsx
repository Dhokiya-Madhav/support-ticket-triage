"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { PageSpinner } from "@/components/ui";
import { homeFor, useAuth } from "@/lib/auth";

/** Keeps people who are already signed in away from the login and register pages. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace(homeFor(user.role));
  }, [user, router]);

  return loading || user ? <PageSpinner /> : <>{children}</>;
}
