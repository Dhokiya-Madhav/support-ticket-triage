"use client";

import { useState } from "react";
import { Alert, Button, Modal, Select } from "@/components/ui";
import { managerApi } from "@/lib/endpoints";
import { errorText } from "@/lib/errors";
import { titleCase } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

/** Managers pick an active agent for a ticket. This overrides the skill match and workload cap. */
export function AssignModal({
  ticketId,
  currentAssigneeId,
  open,
  onClose,
  onAssigned,
}: {
  ticketId: number;
  currentAssigneeId: number | null;
  open: boolean;
  onClose: () => void;
  onAssigned: () => void;
}) {
  // Only active agents can be assigned; the API returns at most 200 per request.
  const { data, error: loadError } = useAsync(
    () => managerApi.agents({ status: "active", limit: 200 }),
    "active-agents",
  );
  const agents = data?.items ?? null;
  const [agentId, setAgentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const options = (agents ?? [])
    .filter((agent) => agent.is_active)
    .map((agent) => ({
      value: String(agent.id),
      label: `${agent.name} · ${agent.open_tickets}/${agent.max_open_tickets} open · ${agent.skills
        .map(titleCase)
        .join(", ")}`,
    }));

  async function onSubmit() {
    setError(null);
    setSaving(true);
    try {
      await managerApi.assign(ticketId, Number(agentId));
      setAgentId("");
      onAssigned();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currentAssigneeId ? "Reassign ticket" : "Assign ticket"}
      description="Choose who should handle this ticket."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={saving} disabled={!agentId}>
            Assign
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {(error || loadError) && <Alert tone="error">{error ?? loadError}</Alert>}
        <Select
          label="Agent"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder={agents ? "Select an agent" : "Loading agents…"}
          options={options.filter((o) => o.value !== String(currentAssigneeId))}
        />
        <p className="text-sm text-muted">
          Manual assignment ignores the agent&apos;s skills and workload limit.
        </p>
      </div>
    </Modal>
  );
}
