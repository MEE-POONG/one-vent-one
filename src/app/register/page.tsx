import { AuthForm } from "@/features/auth/auth-form";
import { googleSignInEnabled } from "@/server/auth/google";
export const metadata = { title: "สมัครสมาชิก" };
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}) {
  const { next, error } = await searchParams;
  return (
    <AuthForm
      signup
      returnTo={typeof next === "string" ? next : undefined}
      googleEnabled={googleSignInEnabled}
      oauthError={typeof error === "string" ? error : undefined}
    />
  );
}
