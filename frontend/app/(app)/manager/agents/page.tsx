"use client";

import { Pencil, Plus, Power, RefreshCw, Search, Trash2, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AgentFormModal } from "@/components/agents/agent-form-modal";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageSpinner,
  Pagination,
  Select,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import { managerApi } from "@/lib/endpoints";
import { errorText } from "@/lib/errors";
import { CATEGORIES, titleCase } from "@/lib/format";
import type { Agent, AgentFilters, Category } from "@/lib/types";
import { useAsync } from "@/lib/use-async";

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

export default function ManagerAgentsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState<Category | "">("");
  const [status, setStatus] = useState<"active" | "inactive" | "">("");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Wait for a pause in typing before asking the server, and go back to the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters: AgentFilters = {
    search: search || undefined,
    skill: skill || undefined,
    status: status || undefined,
    limit: pageSize,
    offset,
  };
  const filtered = Boolean(search || skill || status);

  const { data, error, loading, reload } = useAsync(
    () => managerApi.agents(filters),
    JSON.stringify(filters),
  );
  const agents = data?.items ?? null;

  const [formFor, setFormFor] = useState<Agent | "new" | null>(null);
  const [toggling, setToggling] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState<Agent | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingNow, setDeletingNow] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function changePageSize(size: number) {
    setPageSize(size);
    setOffset(0);
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setSkill("");
    setStatus("");
    setOffset(0);
  }

  async function confirmToggle() {
    if (!toggling) return;
    setSaving(true);
    setToggleError(null);
    try {
      await managerApi.updateAgent(toggling.id, { is_active: !toggling.is_active });
      setToggling(null);
      reload();
    } catch (e) {
      setToggleError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingNow(true);
    setDeleteError(null);
    try {
      await managerApi.deleteAgent(deleting.id);
      setDeleting(null);
      // Deleting the last agent on a later page would leave that page empty.
      if (agents && agents.length === 1 && offset > 0) setOffset(Math.max(0, offset - pageSize));
      else reload();
    } catch (e) {
      setDeleteError(errorText(e));
    } finally {
      setDeletingNow(false);
    }
  }

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-4rem)]">
      <div className="shrink-0">
        <PageHeader
          title="Agents"
          description={
            data
              ? `${data.total} agent${data.total === 1 ? "" : "s"}${filtered ? " match your filters" : ""}. Manage who handles tickets, which topics they cover, and how many they can hold.`
              : "Manage who handles tickets, which topics they cover, and how many they can hold."
          }
          actions={
            <>
              <Button
                variant="ghost"
                icon={<RefreshCw className="size-4" />}
                onClick={reload}
                loading={loading && agents !== null}
              >
                Refresh
              </Button>
              <Button icon={<Plus className="size-4" />} onClick={() => setFormFor("new")}>
                Add agent
              </Button>
            </>
          }
        />

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Input
            aria-label="Search agents"
            type="search"
            className="min-w-60 flex-1 sm:max-w-sm"
            placeholder="Search by name or email…"
            icon={<Search className="size-4" />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Select
            aria-label="Filter by skill"
            className="w-48"
            value={skill}
            onChange={(e) => {
              setSkill(e.target.value as Category | "");
              setOffset(0);
            }}
            placeholder="All skills"
            options={CATEGORIES.map((c) => ({ value: c, label: titleCase(c) }))}
          />
          <Select
            aria-label="Filter by status"
            className="w-40"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "active" | "inactive" | "");
              setOffset(0);
            }}
            placeholder="Any status"
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10"
              icon={<X className="size-4" />}
              onClick={clearFilters}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {!agents && !error && <PageSpinner />}

      {agents && (
        <Card className="flex min-h-0 flex-col overflow-hidden lg:flex-1">
          {agents.length === 0 ? (
            filtered ? (
              <EmptyState
                icon={<Search className="size-6" />}
                title="No agents match"
                description="Try a different name, skill or status."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Users className="size-6" />}
                title="No agents yet"
                description="Add an agent so new tickets can be assigned automatically."
                action={<Button onClick={() => setFormFor("new")}>Add your first agent</Button>}
              />
            )
          ) : (
            <Table containerClassName="max-h-[65dvh] lg:max-h-none lg:min-h-0 lg:flex-1">
              <THead>
                <tr>
                  <Th>Agent</Th>
                  <Th>Skills</Th>
                  <Th>Open / limit</Th>
                  <Th>Status</Th>
                  <Th className="text-right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {agents.map((agent) => (
                  <Tr key={agent.id}>
                    <Td>
                      <p className="font-medium text-foreground">{agent.name}</p>
                      <p className="text-xs text-muted">{agent.email}</p>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {agent.skills.length === 0 ? (
                          <span className="text-muted">None</span>
                        ) : (
                          agent.skills.map((s) => (
                            <Badge key={s} tone={s === skill ? "info" : "purple"}>
                              {titleCase(s)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </Td>
                    <Td className="tabular-nums text-muted">
                      {agent.open_tickets} / {agent.max_open_tickets}
                    </Td>
                    <Td>
                      <Badge tone={agent.is_active ? "success" : "neutral"}>
                        {agent.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <IconButton
                          label="Edit agent"
                          icon={<Pencil className="size-4" />}
                          onClick={() => setFormFor(agent)}
                        />
                        <IconButton
                          label={agent.is_active ? "Deactivate" : "Activate"}
                          icon={<Power className="size-4" />}
                          onClick={() => {
                            setToggleError(null);
                            // Reactivating is harmless; deactivating asks first.
                            if (agent.is_active) setToggling(agent);
                            else
                              managerApi
                                .updateAgent(agent.id, { is_active: true })
                                .then(reload)
                                .catch((e) => setToggleError(errorText(e)));
                          }}
                        />
                        <IconButton
                          label="Delete agent"
                          tone="danger"
                          icon={<Trash2 className="size-4" />}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(agent);
                          }}
                        />
                      </div>
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
          <Pagination
            total={data.total}
            limit={pageSize}
            offset={offset}
            onChange={setOffset}
            onPageSizeChange={changePageSize}
          />
        </div>
      )}

      {toggleError && !toggling && (
        <Alert tone="error" className="mt-4">
          {toggleError}
        </Alert>
      )}

      {formFor && (
        <AgentFormModal
          agent={formFor === "new" ? undefined : formFor}
          onClose={() => setFormFor(null)}
          onSaved={reload}
        />
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? "agent"}?`}
        description="This permanently removes the agent's account and skills. It can't be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              loading={deletingNow}
              onClick={confirmDelete}
            >
              Delete agent
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {deleteError && <Alert tone="error">{deleteError}</Alert>}
          <p className="text-sm text-muted">
            Their {deleting?.open_tickets ?? 0} open ticket(s) go back to the unassigned queue and
            are reassigned automatically to other agents with the right skills. Tickets they
            resolved keep their history but will no longer show an assignee.
          </p>
          <p className="text-sm text-muted">
            If you only want to stop them from working for now, use <strong>Deactivate</strong>{" "}
            instead. That keeps the account and can be undone.
          </p>
        </div>
      </Modal>

      <Modal
        open={toggling !== null}
        onClose={() => setToggling(null)}
        title={`Deactivate ${toggling?.name ?? "agent"}?`}
        description="They will be signed out and can't log in again until reactivated."
        footer={
          <>
            <Button variant="secondary" onClick={() => setToggling(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={saving} onClick={confirmToggle}>
              Deactivate
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {toggleError && <Alert tone="error">{toggleError}</Alert>}
          <p className="text-sm text-muted">
            Their {toggling?.open_tickets ?? 0} open ticket(s) go back to the unassigned queue and
            are reassigned automatically to other agents with the right skills.
          </p>
        </div>
      </Modal>
    </div>
  );
}
