"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageSpinner } from "@/components/ui";
import { homeFor, useAuth } from "@/lib/auth";

// The root has no content of its own: send each visitor to the right place.
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? homeFor(user.role) : "/login");
  }, [user, loading, router]);

  return <PageSpinner />;
}
