"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { StaffTicketList } from "@/components/tickets/staff-ticket-list";
import { PageHeader, PageSpinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function AgentQueuePage() {
  const { user } = useAuth();
  const router = useRouter();

  // Managers have their own list; this queue is the agent's personal workspace.
  useEffect(() => {
    if (user?.role === "manager") router.replace("/manager/tickets");
  }, [user, router]);

  if (user?.role !== "agent") return <PageSpinner />;

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-4rem)]">
      <div className="shrink-0">
      <PageHeader
        title="Ticket queue"
        description="Your assigned tickets, plus unassigned ones you can pick up."
      />
      </div>
      <StaffTicketList variant="agent" />
    </div>
  );
}
