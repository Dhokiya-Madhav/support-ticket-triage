"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, Checkbox, Input, Modal } from "@/components/ui";
import { managerApi } from "@/lib/endpoints";
import { errorText } from "@/lib/errors";
import { CATEGORIES, titleCase } from "@/lib/format";
import type { Agent, Category } from "@/lib/types";

/** Create an agent (no `agent` prop) or edit an existing one. Mount it only while it is open. */
export function AgentFormModal({
  agent,
  onClose,
  onSaved,
}: {
  agent?: Agent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(agent);
  const [name, setName] = useState(agent?.name ?? "");
  const [email, setEmail] = useState(agent?.email ?? "");
  const [password, setPassword] = useState("");
  const [skills, setSkills] = useState<Category[]>(agent?.skills ?? []);
  const [maxOpen, setMaxOpen] = useState(String(agent?.max_open_tickets ?? 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cap = Number(maxOpen);
  const capValid = Number.isInteger(cap) && cap >= 1 && cap <= 100;

  function toggleSkill(category: Category) {
    setSkills((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!capValid) return;
    setError(null);
    setSaving(true);
    try {
      if (agent) {
        await managerApi.updateAgent(agent.id, {
          name: name.trim(),
          skills,
          max_open_tickets: cap,
          ...(password ? { password } : {}),
        });
      } else {
        await managerApi.createAgent({
          name: name.trim(),
          email: email.trim(),
          password,
          skills,
          max_open_tickets: cap,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setSaving(false);
    }
  }

  const formId = "agent-form";
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Edit agent" : "Add agent"}
      description={
        editing
          ? "Change skills, workload limit or password."
          : "Create an account for a support agent. Share the password with them securely."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={saving}
            disabled={skills.length === 0 || !capValid}
          >
            {editing ? "Save changes" : "Create agent"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Input
          label="Full name"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          required
          disabled={editing}
          hint={editing ? "The email can't be changed." : undefined}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label={editing ? "New password" : "Password"}
          type="password"
          autoComplete="new-password"
          required={!editing}
          minLength={8}
          hint={editing ? "Leave blank to keep the current password." : "At least 8 characters."}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Skills</legend>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((category) => (
              <Checkbox
                key={category}
                label={titleCase(category)}
                checked={skills.includes(category)}
                onChange={() => toggleSkill(category)}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">
            Tickets are assigned only to agents with the matching skill. Pick at least one.
          </p>
        </fieldset>
        <Input
          label="Open ticket limit"
          type="number"
          min={1}
          max={100}
          required
          error={capValid ? undefined : "Enter a whole number from 1 to 100."}
          hint="New tickets stop going to this agent once they reach the limit."
          value={maxOpen}
          onChange={(e) => setMaxOpen(e.target.value)}
        />
      </form>
    </Modal>
  );
}
