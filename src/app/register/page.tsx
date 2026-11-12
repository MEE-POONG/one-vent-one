import { AuthForm } from "@/features/auth/auth-form";
export const metadata = { title: "สมัครสมาชิก" };
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthForm signup returnTo={typeof next === "string" ? next : undefined} />
  );
}
