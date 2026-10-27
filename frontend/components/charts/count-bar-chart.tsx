"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { titleCase } from "@/lib/format";
import type { LabelCount } from "@/lib/types";

interface TooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string; payload?: { label: string } }>;
}

function ChartTooltip({ active, payload }: TooltipProps) {
  const item = payload?.[0];
  if (!active || !item?.payload) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="text-muted">{item.payload.label}</p>
      <p className="font-semibold text-foreground">
        {item.value} {Number(item.value) === 1 ? "ticket" : "tickets"}
      </p>
    </div>
  );
}

/** One-series bar chart of ticket counts. A single series needs no legend; the title names it. */
export function CountBarChart({
  title,
  description,
  data,
  order,
}: {
  title: string;
  description?: string;
  data: LabelCount[];
  /** Preferred order of the category keys; unknown keys follow in the order received. */
  order?: string[];
}) {
  const rows = [...data]
    .sort((a, b) => rank(order, a.category) - rank(order, b.category))
    .map((d) => ({ label: titleCase(d.category), count: d.count }));
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody>
        {total === 0 ? (
          <EmptyState title="No tickets in this period" className="py-10" />
        ) : (
          <>
            <div className="h-64 w-full" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tick={{ fill: "var(--muted)", fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted)", fontSize: 12 }}
                  />
                  <Tooltip cursor={{ fill: "var(--surface-muted)" }} content={<ChartTooltip />} />
                  <Bar
                    dataKey="count"
                    fill="var(--series-1)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="count"
                      position="top"
                      fill="var(--foreground)"
                      fontSize={12}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* The same numbers as a table, for screen readers. */}
            <table className="sr-only">
              <caption>{title}</caption>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Tickets</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function rank(order: string[] | undefined, key: string): number {
  const index = order?.indexOf(key) ?? -1;
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
