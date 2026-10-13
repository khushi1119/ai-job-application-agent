import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <p className="text-sm font-medium tracking-tight">ApplyPilot</p>
        <div className="flex items-center gap-2">
          <Link href="/signin" className={cn(buttonVariants({ variant: "ghost" }), "h-8 px-3 text-sm")}>
            Sign in
          </Link>
          <Link href="/signup" className={cn(buttonVariants(), "h-8 px-3 text-sm")}>
            Get started
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 pb-20">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          AI job application agent
        </p>
        <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          A calmer way to apply — with you still in charge.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
          Sign in to start tracking roles and generating application materials. The
          dashboard is private until you authenticate.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className={cn(buttonVariants(), "h-10 px-4 text-sm")}>
            Create an account
          </Link>
          <Link
            href="/signin"
            className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4 text-sm")}
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
