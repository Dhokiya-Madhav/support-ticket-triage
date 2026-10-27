"use client";

import { useParams } from "next/navigation";
import { StaffTicketWorkspace } from "@/components/tickets/staff-ticket-workspace";

export default function AgentTicketPage() {
  const params = useParams<{ id: string }>();
  return <StaffTicketWorkspace ticketId={Number(params.id)} />;
}
