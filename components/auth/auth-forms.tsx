"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  type AuthState,
} from "@/lib/auth/actions";

const initialState: AuthState = { error: null, message: null };

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M5.3 14.3 4.4 15l-2.7 2.1C3.5 20.5 7.5 23 12 23c3 0 5.5-1 7.3-2.7l-3.1-2.4c-.9.6-2 1-3.3 1-2.5 0-4.6-1.7-5.4-4l-2.2-.6z"
      />
      <path
        fill="#4A90E2"
        d="M3.1 6.9C2.4 8.3 2 9.9 2 11.6c0 1.7.4 3.3 1.1 4.7l2.9-2.3c-.2-.6-.3-1.2-.3-1.8s.1-1.3.3-1.9L3.1 6.9z"
      />
      <path
        fill="#FBBC05"
        d="M12 4.8c1.6 0 3 .5 4.1 1.6l3-3C17.4 1.5 14.9.5 12 .5 7.5.5 3.5 3 1.7 6.9l2.9 2.3C5.4 6.5 7.5 4.8 12 4.8z"
      />
    </svg>
  );
}

export function SignInForm({
  nextPath,
  oauthError,
}: {
  nextPath: string;
  oauthError?: string;
}) {
  const [state, formAction, pending] = useActionState(signInWithPassword, initialState);

  return (
    <div className="space-y-5">
      {(oauthError || state.error) && (
        <Alert variant="destructive">
          <AlertDescription>{oauthError || state.error}</AlertDescription>
        </Alert>
      )}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={nextPath} />
        <Button
          type="submit"
          variant="outline"
          className="h-10 w-full gap-2 text-sm"
        >
          <GoogleIcon />
          Continue with Google
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or sign in with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="h-10 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-10 text-sm"
          />
        </div>
        <Button type="submit" disabled={pending} className="h-10 w-full text-sm">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpWithPassword, initialState);

  return (
    <div className="space-y-5">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.message && (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value="/dashboard" />
        <Button type="submit" variant="outline" className="h-10 w-full gap-2 text-sm">
          <GoogleIcon />
          Continue with Google
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or sign up with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            placeholder="Khushi Tiwari"
            className="h-10 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="h-10 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="h-10 text-sm"
          />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <Button type="submit" disabled={pending} className="h-10 w-full text-sm">
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
