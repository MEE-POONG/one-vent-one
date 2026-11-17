import { AuthForm } from "@/features/auth/auth-form";
export const metadata = { title: "เข้าสู่ระบบ" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <AuthForm returnTo={typeof next === "string" ? next : undefined} />;
}
