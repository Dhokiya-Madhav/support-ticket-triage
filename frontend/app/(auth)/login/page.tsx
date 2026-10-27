"use client";

import { Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { Alert, Button, Card, CardBody, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      router.replace(homeFor(user.role));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardBody className="p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to view and manage support requests.</p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {error && <Alert tone="error">{error}</Alert>}
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
            autoComplete="current-password"
            required
            icon={<Lock className="size-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" loading={submitting} fullWidth size="lg">
            Sign in
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <RedirectIfSignedIn>
      <LoginForm />
    </RedirectIfSignedIn>
  );
}
