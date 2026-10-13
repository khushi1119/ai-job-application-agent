import type { ReactNode } from "react";
import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-full flex-1 lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden bg-zinc-950 text-white lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.35),transparent_42%),radial-gradient(circle_at_80%_80%,rgba(14,165,233,0.2),transparent_36%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:56px_56px]"
        />
        <Link href="/" className="relative z-10 text-sm font-medium tracking-tight">
          ApplyPilot
        </Link>
        <div className="relative z-10 max-w-md space-y-5">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-indigo-200">
            AI job application agent
          </p>
          <h2 className="text-4xl font-semibold tracking-tight text-balance">
            Apply faster. Stay in control of every conversation.
          </h2>
          <p className="text-base leading-7 text-zinc-300">
            Sign in to tailor resumes, track applications, and let the agent handle the
            busywork — without sending anything you have not approved.
          </p>
        </div>
        <p className="relative z-10 text-sm text-zinc-400">
          Your applications. Your voice. A calmer job search.
        </p>
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-[420px]">
          <Link
            href="/"
            className="mb-10 inline-flex text-sm font-medium tracking-tight text-foreground lg:hidden"
          >
            ApplyPilot
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
