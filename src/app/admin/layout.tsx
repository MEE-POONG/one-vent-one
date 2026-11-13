import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentStaff } from "@/server/auth";
import { AdminShell } from "@/features/admin/admin-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Anyone who is not staff (customers and signed-out visitors alike) gets the
// ordinary 404 page, so the back office looks like it does not exist. Staff
// sign in at /login, which sends them here. This only hides the pages: every
// /api/admin request still checks permissions on the server.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await currentStaff())) notFound();
  return <AdminShell>{children}</AdminShell>;
}
