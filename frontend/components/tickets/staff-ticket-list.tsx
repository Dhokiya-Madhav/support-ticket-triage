"use client";

import { Inbox, RefreshCw, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AssignModal } from "@/components/tickets/assign-modal";
import {
  Alert,
  Badge,
  Button,
  Card,
  CategoryBadge,
  EmptyState,
  IconButton,
  Input,
  PageSpinner,
  Pagination,
  Select,
  StatusBadge,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  UrgencyBadge,
} from "@/components/ui";
import { agentApi } from "@/lib/endpoints";
import { CATEGORIES, URGENCIES, formatRelative, titleCase } from "@/lib/format";
import type { AgentTicketFilters, AgentTicketItem, Category, TicketStatus, Urgency } from "@/lib/types";
import { useAsync } from "@/lib/use-async";

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

type AgentTab = "mine" | "unassigned";
type ManagerTab = "all" | "unassigned" | "failed";

const TAB_FILTERS: Record<AgentTab | ManagerTab, AgentTicketFilters> = {
  mine: { scope: "mine" },
  all: { scope: "all" },
  unassigned: { scope: "unassigned" },
  failed: { scope: "all", triage_status: "failed" },
};

/**
 * Filterable ticket table shared by agents (their queue) and managers (every ticket).
 * Managers also get an Assign button on each row.
 */
export function StaffTicketList({ variant }: { variant: "agent" | "manager" }) {
  const isManager = variant === "manager";
  const tabs = isManager
    ? [
        { value: "all", label: "All tickets" },
        { value: "unassigned", label: "Unassigned" },
        { value: "failed", label: "Triage failed" },
      ]
    : [
        { value: "mine", label: "My tickets" },
        { value: "unassigned", label: "Unassigned" },
      ];

  const [tab, setTab] = useState<AgentTab | ManagerTab>(isManager ? "all" : "mine");
  const [status, setStatus] = useState<TicketStatus | "">("open");
  const [category, setCategory] = useState<Category | "">("");
  const [urgency, setUrgency] = useState<Urgency | "">("");
  const [overdue, setOverdue] = useState<"" | "true" | "false">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [assigning, setAssigning] = useState<AgentTicketItem | null>(null);

  // Wait for a pause in typing before asking the server, and go back to the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters: AgentTicketFilters = {
    ...TAB_FILTERS[tab],
    status: status || undefined,
    category: category || undefined,
    urgency: urgency || undefined,
    overdue: overdue === "" ? undefined : overdue === "true",
    search: search || undefined,
    limit: pageSize,
    offset,
  };
  const { data, error, loading, reload } = useAsync(
    () => agentApi.list(filters),
    JSON.stringify(filters),
  );

  function changePageSize(size: number) {
    setPageSize(size);
    setOffset(0);
  }

  // Any filter change goes back to the first page.
  const change = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setOffset(0);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex shrink-0 flex-wrap items-end gap-3">
        <Input
          aria-label="Search tickets"
          type="search"
          className="min-w-60 flex-1 sm:max-w-sm"
          placeholder="Search subject, customer or ticket #…"
          icon={<Search className="size-4" />}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          label="Show"
          className="w-44"
          value={tab}
          onChange={(e) => {
            setTab(e.target.value as AgentTab | ManagerTab);
            setOffset(0);
          }}
          options={tabs}
        />
        <Select
          label="Status"
          className="w-36"
          value={status}
          onChange={(e) => change(setStatus)(e.target.value as TicketStatus | "")}
          placeholder="Any"
          options={[
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
          ]}
        />
        <Select
          label="Category"
          className="w-36"
          value={category}
          onChange={(e) => change(setCategory)(e.target.value as Category | "")}
          placeholder="Any"
          options={CATEGORIES.map((c) => ({ value: c, label: titleCase(c) }))}
        />
        <Select
          label="Urgency"
          className="w-36"
          value={urgency}
          onChange={(e) => change(setUrgency)(e.target.value as Urgency | "")}
          placeholder="Any"
          options={URGENCIES.map((u) => ({ value: u, label: titleCase(u) }))}
        />
        <Select
          label="SLA"
          className="w-40"
          value={overdue}
          onChange={(e) => change(setOverdue)(e.target.value as "" | "true" | "false")}
          placeholder="Any"
          options={[
            { value: "true", label: "Overdue" },
            { value: "false", label: "Not overdue" },
          ]}
        />
        {/* Managers get a fresh list from the filters and search; agents keep a manual refresh. */}
        {!isManager && (
          <Button
            variant="ghost"
            className="ml-auto"
            size="sm"
            icon={<RefreshCw className="size-4" />}
            onClick={reload}
            loading={loading && data !== null}
          >
            Refresh
          </Button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {!data && !error && <PageSpinner />}

      {data && (
        <Card className="flex min-h-0 flex-col overflow-hidden lg:flex-1">
          {data.items.length === 0 ? (
            <EmptyState
              icon={<Inbox className="size-6" />}
              title="No tickets here"
              description="Nothing matches these filters right now."
            />
          ) : (
            <Table containerClassName="max-h-[65dvh] lg:max-h-none lg:min-h-0 lg:flex-1">
              <THead>
                <tr>
                  <Th>Ticket</Th>
                  <Th>Category</Th>
                  <Th>Urgency</Th>
                  <Th>Status</Th>
                  <Th className="hidden lg:table-cell">{isManager ? "Assignee" : "Customer"}</Th>
                  <Th className="hidden md:table-cell">First response due</Th>
                  {isManager && (
                    <Th className="text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  )}
                </tr>
              </THead>
              <TBody>
                {data.items.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    isManager={isManager}
                    onAssign={() => setAssigning(ticket)}
                  />
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}

      {data && (
        <div className="shrink-0">
          <Pagination
            total={data.total}
            limit={pageSize}
            offset={offset}
            onChange={setOffset}
            onPageSizeChange={changePageSize}
          />
        </div>
      )}

      {assigning && (
        <AssignModal
          open
          ticketId={assigning.id}
          currentAssigneeId={assigning.assignee?.id ?? null}
          onClose={() => setAssigning(null)}
          onAssigned={reload}
        />
      )}
    </div>
  );
}

function TicketRow({
  ticket,
  isManager,
  onAssign,
}: {
  ticket: AgentTicketItem;
  isManager: boolean;
  onAssign: () => void;
}) {
  return (
    <Tr>
      <Td className="max-w-xs">
        <Link
          href={`/agent/${ticket.id}`}
          className="font-medium text-foreground hover:text-primary hover:underline"
        >
          {ticket.subject}
        </Link>
        <p className="truncate text-xs text-muted">
          #{ticket.id}
          {ticket.summary ? ` · ${ticket.summary}` : ""}
        </p>
      </Td>
      <Td>
        {ticket.triage_status === "failed" ? (
          <Badge tone="warning">Triage failed</Badge>
        ) : ticket.triage_status === "pending" ? (
          <Badge>Triaging…</Badge>
        ) : (
          <CategoryBadge category={ticket.category} />
        )}
      </Td>
      <Td>{ticket.triage_status === "done" && <UrgencyBadge urgency={ticket.urgency} />}</Td>
      <Td>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={ticket.status} />
          {ticket.is_overdue && <Badge tone="danger">Overdue</Badge>}
        </div>
      </Td>
      <Td className="hidden text-muted lg:table-cell">
        {isManager ? (ticket.assignee?.name ?? <span className="italic">Unassigned</span>) : ticket.customer_name}
      </Td>
      <Td className="hidden text-muted md:table-cell">
        {ticket.first_response_at
          ? "Responded"
          : ticket.status === "resolved"
            ? "–"
            : formatRelative(ticket.due_at)}
      </Td>
      {isManager && (
        <Td className="text-right">
          {ticket.status === "open" && (
            <IconButton
              label={ticket.assignee ? "Reassign" : "Assign"}
              icon={<UserPlus className="size-4" />}
              onClick={onAssign}
            />
          )}
        </Td>
      )}
    </Tr>
  );
}
