import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/auth-forms";

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start tracking applications and generating tailored materials in minutes."
    >
      <SignUpForm />
    </AuthShell>
  );
}
