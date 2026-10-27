"use client";

import { Inbox, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
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
} from "@/components/ui";
import { customerApi } from "@/lib/endpoints";
import { formatDate, formatRelative } from "@/lib/format";
import type { TicketStatus } from "@/lib/types";
import { useAsync } from "@/lib/use-async";

const PAGE_SIZE = 10;

export default function MyTicketsPage() {
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [offset, setOffset] = useState(0);

  const { data, error, loading, reload } = useAsync(
    () =>
      customerApi.list({ status: status || undefined, limit: PAGE_SIZE, offset }),
    JSON.stringify({ status, offset }),
  );

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-4rem)]">
      <div className="shrink-0">
      <PageHeader
        title="My requests"
        description="Everything you've sent to support, and where it stands."
        actions={
          <Link href="/tickets/new">
            <Button icon={<Plus className="size-4" />}>New request</Button>
          </Link>
        }
      />

      <div className="mb-4 flex items-end justify-between gap-3">
        <Select
          label="Status"
          className="w-44"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TicketStatus | "");
            setOffset(0);
          }}
          placeholder="All requests"
          options={[
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
          ]}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className="size-4" />}
          onClick={reload}
          loading={loading && data !== null}
        >
          Refresh
        </Button>
      </div>

      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {!data && !error && <PageSpinner />}

      {data && (
        <Card className="flex min-h-0 flex-col overflow-hidden lg:flex-1">
          {data.items.length === 0 ? (
            <EmptyState
              icon={<Inbox className="size-6" />}
              title={status ? "No matching requests" : "No requests yet"}
              description={
                status
                  ? "Try a different status filter."
                  : "When you contact support, your requests will show up here."
              }
              action={
                !status && (
                  <Link href="/tickets/new">
                    <Button>Create your first request</Button>
                  </Link>
                )
              }
            />
          ) : (
            <Table containerClassName="max-h-[65dvh] lg:max-h-none lg:min-h-0 lg:flex-1">
              <THead>
                <tr>
                  <Th>Subject</Th>
                  <Th>Status</Th>
                  <Th className="hidden sm:table-cell">Last activity</Th>
                  <Th className="hidden md:table-cell">Created</Th>
                </tr>
              </THead>
              <TBody>
                {data.items.map((ticket) => (
                  <Tr key={ticket.id}>
                    <Td>
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {ticket.subject}
                      </Link>
                      <p className="text-xs text-muted">Request #{ticket.id}</p>
                    </Td>
                    <Td>
                      <StatusBadge status={ticket.status} />
                    </Td>
                    <Td className="hidden text-muted sm:table-cell">
                      {formatRelative(ticket.last_activity_at)}
                    </Td>
                    <Td className="hidden text-muted md:table-cell">
                      {formatDate(ticket.created_at)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}

      {data && (
        <div className="shrink-0">
          <Pagination total={data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </div>
      )}
    </div>
  );
}
