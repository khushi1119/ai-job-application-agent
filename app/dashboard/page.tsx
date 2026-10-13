import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect("/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  const displayName = profile?.full_name || profile?.email || "there";

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <p className="text-sm font-medium tracking-tight">ApplyPilot</p>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="h-8 px-3 text-sm">
            Sign out
          </Button>
        </form>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Welcome, {displayName}.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          You are signed in. This space will hold your applications, tailored resumes,
          and agent activity.
        </p>
      </main>
    </div>
  );
}
