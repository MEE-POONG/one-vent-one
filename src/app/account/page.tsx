import { redirect } from "next/navigation";
import { requireActor } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { UserProfile } from "@/features/account/user-profile";
import "@/features/account/profile.css";

export const metadata = { title: "โปรไฟล์ของฉัน" };

export default async function AccountPage() {
  try {
    await requireActor();
  } catch (error) {
    if (!(error instanceof DomainError) || error.status !== 401) throw error;
    redirect("/login?next=%2Faccount");
  }
  return <UserProfile />;
}
