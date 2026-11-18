import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { authDestination } from "@/lib/auth-redirect";
import { isStaff, rolesOf } from "@/lib/roles";

export default async function AuthCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const returnTo = typeof next === "string" ? next : undefined;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    const query = new URLSearchParams({ error: "session_expired" });
    if (returnTo) query.set("next", authDestination(returnTo));
    redirect(`/login?${query}`);
  }
  redirect(
    authDestination(
      returnTo,
      isStaff(rolesOf(session)) ? "/admin" : "/account/bookings",
    ),
  );
}
