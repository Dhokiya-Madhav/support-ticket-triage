"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Paperclip,
  RefreshCw,
  Sparkles,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AssignModal } from "@/components/tickets/assign-modal";
import {
  CommentComposer,
  CommentsButton,
  CommentsDrawer,
  CommentsNotice,
  CommentThread,
} from "@/components/tickets/comments";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CategoryBadge,
  Modal,
  PageSpinner,
  SentimentBadge,
  StatusBadge,
  UrgencyBadge,
} from "@/components/ui";
import { attachmentUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { agentApi } from "@/lib/endpoints";
import { errorText } from "@/lib/errors";
import { formatBytes, formatDateTime, formatRelative } from "@/lib/format";
import type { AgentTicketDetail } from "@/lib/types";
import { useAsync } from "@/lib/use-async";

type Action = "claim" | "comment" | "resolve" | "retriage";

export function StaffTicketWorkspace({ ticketId }: { ticketId: number }) {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const backHref = isManager ? "/manager/tickets" : "/agent";

  const { data: ticket, error: loadError, loading, reload, setData } = useAsync(
    () => agentApi.get(ticketId),
    String(ticketId),
  );

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [assigning, setAssigning] = useState(false);

  if (loadError && !ticket) {
    return (
      <>
        <BackLink href={backHref} />
        <Alert tone="error">{loadError}</Alert>
      </>
    );
  }
  if (!ticket) return <PageSpinner />;

  const resolved = ticket.status === "resolved";
  const mine = ticket.assignee?.id === user?.id;
  // Agents can only change tickets they own; managers can change any.
  const canEdit = !resolved && (isManager || mine);
  const canClaim = !resolved && !ticket.assignee && user?.role === "agent";
  const canReassign = isManager && !resolved;
  // Re-running the AI triage is a manager-only action.
  const canRetriage = canReassign && ticket.triage_status !== "pending";
  // The first message is the customer's request; everything after it is a comment.
  const [original, ...comments] = ticket.messages;
  const suggestion = ticket.draft?.body ?? "";
  const suggestionWaiting = canEdit && Boolean(suggestion) && comment !== suggestion;

  async function run(action: Action, call: () => Promise<AgentTicketDetail>, message: string) {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      setData(await call());
      setNotice(message);
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function postComment() {
    setCommentError(null);
    setBusy("comment");
    try {
      setData(await agentApi.reply(ticketId, comment.trim()));
      setComment("");
    } catch (e) {
      setCommentError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  let commentsFooter: ReactNode;
  if (resolved) {
    commentsFooter = (
      <CommentsNotice>
        This ticket is resolved, so commenting is disabled. If the customer comments again, it
        reopens automatically.
      </CommentsNotice>
    );
  } else if (canClaim) {
    commentsFooter = (
      <CommentsNotice>
        <span className="font-medium text-foreground">This ticket is unassigned.</span> Claim it
        to comment, use the AI suggestion or resolve it.
      </CommentsNotice>
    );
  } else if (!canEdit) {
    commentsFooter = (
      <CommentsNotice>
        This ticket is assigned to {ticket.assignee?.name ?? "another agent"}, so commenting is
        disabled.
      </CommentsNotice>
    );
  } else {
    commentsFooter = (
      <CommentComposer
        value={comment}
        onChange={setComment}
        onSubmit={postComment}
        submitting={busy === "comment"}
        disabled={busy !== null}
        error={commentError}
        placeholder="Write a comment for the customer…"
        header={
          suggestionWaiting ? (
            <div className="rounded-xl border border-primary/30 bg-primary-soft p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="size-3.5" aria-hidden />
                  AI suggested reply
                </p>
                <Button size="sm" variant="secondary" onClick={() => setComment(suggestion)}>
                  Use suggestion
                </Button>
              </div>
              <p className="mt-2 line-clamp-3 text-sm break-words whitespace-pre-wrap text-foreground">
                {suggestion}
              </p>
            </div>
          ) : undefined
        }
      />
    );
  }

  return (
    <div>
      <BackLink href={backHref} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-muted">
            Ticket #{ticket.id} · opened {formatDateTime(ticket.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          {ticket.is_overdue && <Badge tone="danger">Overdue</Badge>}
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="size-4" />}
            onClick={reload}
            loading={loading}
          >
            Refresh
          </Button>
          {canClaim && (
            <Button
              loading={busy === "claim"}
              disabled={busy !== null}
              onClick={() => run("claim", () => agentApi.claim(ticketId), "Ticket claimed.")}
            >
              Claim this ticket
            </Button>
          )}
          {resolved && (
            <span className="text-sm text-muted">
              Resolved {ticket.resolved_at ? formatRelative(ticket.resolved_at) : ""}
            </span>
          )}
          <CommentsButton
            count={comments.length}
            open={commentsOpen}
            indicator={suggestionWaiting}
            onClick={() => setCommentsOpen((open) => !open)}
          />
        </div>
      </div>

      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" className="mb-4">
          {notice}
        </Alert>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          {original && (
            <Card>
              <CardHeader
                title="Customer request"
                description={`From ${ticket.customer.name} · ${formatDateTime(original.created_at)}`}
                action={
                  canEdit ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<CheckCircle2 className="size-4" />}
                      disabled={busy !== null}
                      onClick={() => setConfirmResolve(true)}
                    >
                      Mark as resolved
                    </Button>
                  ) : undefined
                }
              />
              <CardBody className="flex flex-col gap-4">
                <p className="text-sm break-words whitespace-pre-wrap text-foreground">
                  {original.body_text}
                </p>
                {original.attachments.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {original.attachments.map((file) => (
                      <li key={file.id}>
                        <a
                          href={attachmentUrl(file.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-muted"
                        >
                          <Paperclip className="size-3.5 text-muted" aria-hidden />
                          {file.filename}
                          <span className="text-muted">({formatBytes(file.size)})</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="AI triage"
              action={
                canRetriage ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Sparkles className="size-4" />}
                    loading={busy === "retriage"}
                    disabled={busy !== null}
                    onClick={() =>
                      run(
                        "retriage",
                        () => agentApi.retriage(ticketId),
                        "Re-triage started. Refresh in a few seconds to see the new analysis.",
                      )
                    }
                  >
                    Re-run triage
                  </Button>
                ) : undefined
              }
            />
            <CardBody className="flex flex-col gap-4">
              {ticket.triage_status === "failed" && (
                <Alert tone="warning" title="Triage failed">
                  The AI couldn&apos;t analyse this ticket. A manager can re-run the triage, or you can handle it manually.
                </Alert>
              )}
              {ticket.triage_status === "pending" && (
                <Alert tone="info">Triage in progress. Refresh in a moment.</Alert>
              )}
              {ticket.triage_status === "done" && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <CategoryBadge category={ticket.category} />
                    <UrgencyBadge urgency={ticket.urgency} />
                    <SentimentBadge sentiment={ticket.sentiment} />
                  </div>
                  {ticket.summary && <p className="text-sm text-foreground">{ticket.summary}</p>}
                </>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <Detail label="Customer">
                {ticket.customer.name}
                <span className="block break-all text-muted">{ticket.customer.email}</span>
              </Detail>
              <Detail label="Assignee">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {ticket.assignee ? (
                    ticket.assignee.name
                  ) : (
                    <span className="text-muted italic">Unassigned</span>
                  )}
                  {canReassign && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<UserPlus className="size-4" />}
                      onClick={() => setAssigning(true)}
                    >
                      {ticket.assignee ? "Reassign" : "Assign"}
                    </Button>
                  )}
                </div>
              </Detail>
              <Detail label="First response">
                {ticket.first_response_at
                  ? formatDateTime(ticket.first_response_at)
                  : `Due ${formatRelative(ticket.due_at)}`}
              </Detail>
              <Detail label="Opened">{formatDateTime(ticket.created_at)}</Detail>
              <Detail label="Comments">{comments.length}</Detail>
              {ticket.resolved_at && (
                <Detail label="Resolved">{formatDateTime(ticket.resolved_at)}</Detail>
              )}
            </dl>
          </CardBody>
        </Card>
      </div>

      <CommentsDrawer
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        count={comments.length}
        subtitle={`#${ticket.id} · ${ticket.subject}`}
        footer={commentsFooter}
      >
        <CommentThread
          comments={comments}
          author={(c) => (c.direction === "outbound" ? c.sender : ticket.customer.name)}
          role={(c) =>
            c.direction === "outbound"
              ? { label: "Support", tone: "info" }
              : { label: "Customer", tone: "neutral" }
          }
          isMine={(c) => c.direction === "outbound"}
        />
      </CommentsDrawer>

      <Modal
        open={confirmResolve}
        onClose={() => setConfirmResolve(false)}
        title="Mark this ticket as resolved?"
        description="The customer will see it as resolved. If they comment again, it reopens."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmResolve(false)}>
              Cancel
            </Button>
            <Button
              loading={busy === "resolve"}
              onClick={async () => {
                const ok = await run("resolve", () => agentApi.resolve(ticketId), "Ticket resolved.");
                if (ok) setConfirmResolve(false);
              }}
            >
              Resolve ticket
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {ticket.first_response_at
            ? "You've already responded to the customer."
            : "You haven't commented for the customer yet. Resolving now will not count as a first response."}
        </p>
      </Modal>

      {assigning && (
        <AssignModal
          open
          ticketId={ticketId}
          currentAssigneeId={ticket.assignee?.id ?? null}
          onClose={() => setAssigning(false)}
          onAssigned={reload}
        />
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to tickets
    </Link>
  );
}
