import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/auth-forms";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/dashboard";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to your application dashboard."
    >
      <SignInForm nextPath={nextPath} oauthError={params.error} />
    </AuthShell>
  );
}
