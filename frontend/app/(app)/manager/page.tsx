"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  RefreshCw,
  Timer,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CountBarChart } from "@/components/charts/count-bar-chart";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  PageHeader,
  PageSpinner,
  Select,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import { managerApi } from "@/lib/endpoints";
import { formatHours } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export default function ManagerDashboardPage() {
  const [days, setDays] = useState("30");
  const { data, error, loading, reload } = useAsync(
    () => managerApi.dashboard(Number(days)),
    days,
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="How the support team is doing."
        actions={
          <>
            <Select
              aria-label="Period"
              className="w-44"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              options={PERIODS}
            />
            <Button
              variant="ghost"
              icon={<RefreshCw className="size-4" />}
              onClick={reload}
              loading={loading && data !== null}
            >
              Refresh
            </Button>
          </>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}
      {!data && !error && <PageSpinner />}

      {data && (
        <div className="flex flex-col gap-6">
          {(data.unassigned_open > 0 || data.triage_failed_open > 0) && (
            <Alert tone="warning" title="Needs attention">
              {data.unassigned_open > 0 && (
                <span>{data.unassigned_open} open ticket(s) have no agent. </span>
              )}
              {data.triage_failed_open > 0 && (
                <span>{data.triage_failed_open} ticket(s) failed AI triage. </span>
              )}
              <Link href="/manager/tickets" className="font-medium underline">
                Review tickets
              </Link>
            </Alert>
          )}

          <section aria-label="Current queue" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Open tickets" value={data.open_tickets} icon={<Inbox className="size-5" />} />
            <StatCard
              label="Unassigned"
              value={data.unassigned_open}
              tone={data.unassigned_open > 0 ? "warning" : "default"}
              icon={<UserX className="size-5" />}
            />
            <StatCard
              label="Overdue"
              value={data.overdue_open}
              hint={`No reply within ${data.sla_hours}h`}
              tone={data.overdue_open > 0 ? "danger" : "success"}
              icon={<AlertTriangle className="size-5" />}
            />
            <StatCard
              label="Triage failed"
              value={data.triage_failed_open}
              tone={data.triage_failed_open > 0 ? "warning" : "default"}
              icon={<AlertTriangle className="size-5" />}
            />
          </section>

          <section
            aria-label={`Last ${data.period_days} days`}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <StatCard
              label="Avg first response"
              value={formatHours(data.avg_first_response_hours)}
              hint={`Median ${formatHours(data.median_first_response_hours)}`}
              icon={<Timer className="size-5" />}
            />
            <StatCard
              label={`Within ${data.sla_hours}h SLA`}
              value={data.sla_compliance_pct === null ? "–" : `${data.sla_compliance_pct}%`}
              hint="Of tickets answered or past due"
              tone={
                data.sla_compliance_pct === null
                  ? "default"
                  : data.sla_compliance_pct >= 90
                    ? "success"
                    : data.sla_compliance_pct >= 70
                      ? "warning"
                      : "danger"
              }
              icon={<Clock className="size-5" />}
            />
            <StatCard label="Created" value={data.created_in_period} icon={<Inbox className="size-5" />} />
            <StatCard
              label="Resolved"
              value={data.resolved_in_period}
              tone="success"
              icon={<CheckCircle2 className="size-5" />}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <CountBarChart
              title="Tickets by category"
              description={`Created in the last ${data.period_days} days`}
              data={data.by_category}
              order={[
                "billing",
                "refund",
                "login",
                "account",
                "bug",
                "integration",
                "feature_request",
                "cancellation",
                "general",
                "untriaged",
              ]}
            />
            <CountBarChart
              title="Tickets by urgency"
              description={`Created in the last ${data.period_days} days`}
              data={data.by_urgency}
              order={["high", "medium", "low", "untriaged"]}
            />
          </section>

          <Card>
            <CardHeader
              title="Agent workload"
              description={`Open tickets against each agent's limit; resolved over the last ${data.period_days} days`}
              action={
                <Link href="/manager/agents">
                  <Button variant="secondary" size="sm">
                    Manage agents
                  </Button>
                </Link>
              }
            />
            {data.agents.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">
                No agents yet.{" "}
                <Link href="/manager/agents" className="font-medium text-primary hover:underline">
                  Add your first agent
                </Link>
              </p>
            ) : (
              <Table containerClassName="max-h-96">
                <THead>
                  <tr>
                    <Th>Agent</Th>
                    <Th className="min-w-44">Open / limit</Th>
                    <Th>Overdue</Th>
                    <Th>Resolved</Th>
                  </tr>
                </THead>
                <TBody>
                  {data.agents.map((agent) => {
                    const pct = Math.min(100, (agent.open_tickets / agent.max_open_tickets) * 100);
                    const full = agent.open_tickets >= agent.max_open_tickets;
                    return (
                      <Tr key={agent.agent_id}>
                        <Td className="font-medium">
                          {agent.name}
                          {!agent.is_active && (
                            <Badge className="ml-2" tone="neutral">
                              Inactive
                            </Badge>
                          )}
                        </Td>
                        <Td>
                          <div className="flex items-center gap-3">
                            <div
                              className="h-2 w-28 overflow-hidden rounded-full bg-surface-muted"
                              role="progressbar"
                              aria-valuenow={agent.open_tickets}
                              aria-valuemin={0}
                              aria-valuemax={agent.max_open_tickets}
                              aria-label={`${agent.name} workload`}
                            >
                              <div
                                className={full ? "h-full bg-amber-500" : "h-full bg-primary"}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-muted tabular-nums">
                              {agent.open_tickets} / {agent.max_open_tickets}
                            </span>
                          </div>
                        </Td>
                        <Td>
                          {agent.overdue_tickets > 0 ? (
                            <Badge tone="danger">{agent.overdue_tickets}</Badge>
                          ) : (
                            <span className="text-muted">0</span>
                          )}
                        </Td>
                        <Td className="tabular-nums">{agent.resolved_in_period}</Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
