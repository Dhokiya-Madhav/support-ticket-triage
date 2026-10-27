"use client";

import { StaffTicketList } from "@/components/tickets/staff-ticket-list";
import { PageHeader } from "@/components/ui";

export default function ManagerTicketsPage() {
  return (
    <div className="flex flex-col lg:h-[calc(100dvh-4rem)]">
      <div className="shrink-0">
      <PageHeader
        title="All tickets"
        description="Every ticket in the system. Assign or reassign tickets, and review ones the AI couldn't triage."
      />
      </div>
      <StaffTicketList variant="manager" />
    </div>
  );
}
