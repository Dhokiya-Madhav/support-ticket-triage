"use client";

import { Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { Alert, Button, Card, CardBody, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: real people never see or fill this
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = await register({ name: name.trim(), email: email.trim(), password, website });
      router.replace(homeFor(user.role));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardBody className="p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          Sign up to send support requests and follow their progress.
        </p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Input
            label="Full name"
            autoComplete="name"
            required
            maxLength={200}
            icon={<User className="size-4" />}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            icon={<Mail className="size-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters."
            icon={<Lock className="size-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            icon={<Lock className="size-4" />}
            error={mismatch ? "Passwords do not match." : undefined}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>
          <Button type="submit" loading={submitting} fullWidth size="lg">
            Create account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <RedirectIfSignedIn>
      <RegisterForm />
    </RedirectIfSignedIn>
  );
}
