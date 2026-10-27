"use client";

import { ArrowLeft, Paperclip, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  CommentComposer,
  CommentsButton,
  CommentsDrawer,
  CommentThread,
} from "@/components/tickets/comments";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  PageSpinner,
  StatusBadge,
} from "@/components/ui";
import { attachmentUrl } from "@/lib/api";
import { customerApi } from "@/lib/endpoints";
import { errorText } from "@/lib/errors";
import { formatBytes, formatDateTime, formatRelative } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

const MAX_FILE_MB = 20;
const ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.log,.docx,.xlsx";

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = Number(params.id);

  const { data: ticket, error, loading, reload, setData } = useAsync(
    () => customerApi.get(ticketId),
    String(ticketId),
  );

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [postError, setPostError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  async function onPost() {
    setPostError(null);
    setPosting(true);
    try {
      setData(await customerApi.reply(ticketId, body.trim(), files));
      setBody("");
      setFiles([]);
    } catch (e) {
      setPostError(errorText(e));
    } finally {
      setPosting(false);
    }
  }

  if (error && !ticket) {
    return (
      <>
        <BackLink />
        <Alert tone="error">{error}</Alert>
      </>
    );
  }
  if (!ticket) return <PageSpinner />;

  const resolved = ticket.status === "resolved";
  // The first message is the request itself; everything after it is a comment.
  const [original, ...comments] = ticket.messages;
  const lastMessage = ticket.messages[ticket.messages.length - 1];
  const supportComments = comments.filter((m) => m.direction === "outbound").length;

  const statusText = resolved
    ? "This request has been marked resolved. If you still need help, add a comment and it will reopen."
    : supportComments > 0
      ? "Support has commented on your request. Open the comments to read it and reply."
      : "We've received your request. Our team will comment as soon as possible.";

  return (
    <div>
      <BackLink />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-muted">
            Request #{ticket.id} · opened {formatDateTime(ticket.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="size-4" />}
            onClick={reload}
            loading={loading}
          >
            Refresh
          </Button>
          <CommentsButton
            count={comments.length}
            open={commentsOpen}
            onClick={() => setCommentsOpen((open) => !open)}
          />
        </div>
      </div>

      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        {original && (
          <Card className="xl:col-span-2">
            <CardHeader title="Your request" description="What you originally sent us." />
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
          <CardHeader title="Status" />
          <CardBody className="flex flex-col gap-5">
            <Alert tone={resolved ? "success" : "info"}>{statusText}</Alert>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <Fact label="Request number">#{ticket.id}</Fact>
              <Fact label="Status">
                <StatusBadge status={ticket.status} />
              </Fact>
              <Fact label="Opened">{formatDateTime(ticket.created_at)}</Fact>
              <Fact label="Last activity">
                {lastMessage ? formatRelative(lastMessage.created_at) : "–"}
              </Fact>
              <Fact label="Comments">{comments.length}</Fact>
              {ticket.resolved_at && (
                <Fact label="Resolved">{formatDateTime(ticket.resolved_at)}</Fact>
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
        footer={
          <CommentComposer
            value={body}
            onChange={setBody}
            onSubmit={onPost}
            submitting={posting}
            error={postError}
            placeholder={
              resolved ? "Still need help? Comment here to reopen this request…" : "Write a comment…"
            }
            submitLabel={resolved ? "Reopen and post" : "Post"}
            files={files}
            onFilesChange={setFiles}
            accept={ACCEPT}
            maxFiles={5}
            maxSizeMb={MAX_FILE_MB}
          />
        }
      >
        <CommentThread
          comments={comments}
          author={(c) => (c.direction === "inbound" ? "You" : "Support team")}
          role={(c) => (c.direction === "outbound" ? { label: "Support", tone: "info" } : null)}
          isMine={(c) => c.direction === "inbound"}
        />
      </CommentsDrawer>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/tickets"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      All requests
    </Link>
  );
}
