"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  FileInput,
  Input,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { customerApi } from "@/lib/endpoints";
import { errorText } from "@/lib/errors";

const MAX_SUBJECT = 200;
const MAX_DESCRIPTION = 10_000;
const MAX_FILE_MB = 20;
const ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.log,.docx,.xlsx";

export default function NewTicketPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const oversize = files.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (oversize) return;
    setError(null);
    setSubmitting(true);
    try {
      const ticket = await customerApi.create(subject.trim(), description.trim(), files);
      router.push(`/tickets/${ticket.id}`);
    } catch (e) {
      setError(errorText(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New support request"
        description="Tell us what's going on. The more detail you give, the faster we can help."
      />
      <Card>
        <CardBody>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            {error && <Alert tone="error">{error}</Alert>}
            <Input
              label="Subject"
              required
              maxLength={MAX_SUBJECT}
              placeholder="e.g. I was charged twice this month"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <Textarea
              label="Describe the problem"
              required
              rows={8}
              maxLength={MAX_DESCRIPTION}
              hint={`${description.length.toLocaleString()} / ${MAX_DESCRIPTION.toLocaleString()} characters`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <FileInput
              label="Attachments (optional)"
              hint={`Up to 5 files, ${MAX_FILE_MB} MB each. Images, PDF, text, CSV, Word or Excel.`}
              files={files}
              onChange={setFiles}
              accept={ACCEPT}
              maxFiles={5}
              maxSizeMb={MAX_FILE_MB}
              error={oversize ? `${oversize.name} is larger than ${MAX_FILE_MB} MB.` : undefined}
            />
            <div className="flex justify-end gap-2">
              <Link href="/tickets">
                <Button variant="secondary">Cancel</Button>
              </Link>
              <Button
                type="submit"
                loading={submitting}
                disabled={Boolean(oversize)}
                icon={<Send className="size-4" />}
              >
                Submit request
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
