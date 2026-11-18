import { AuthForm } from "@/features/auth/auth-form";
import { googleSignInEnabled } from "@/server/auth/google";
export const metadata = { title: "เข้าสู่ระบบ" };
export default async function LoginPage({
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
      returnTo={typeof next === "string" ? next : undefined}
      googleEnabled={googleSignInEnabled}
      oauthError={typeof error === "string" ? error : undefined}
    />
  );
}
