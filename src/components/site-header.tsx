"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Ticket, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
export function SiteHeader() {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const roles =
    (session?.user as { roles?: string[] } | undefined)?.roles || [];
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="OneVentOne หน้าแรก">
          OneVent<span>One</span>
        </Link>
        <nav aria-label="เมนูหลัก">
          <Link
            href="/events"
            className={pathname.startsWith("/events") ? "active" : ""}
          >
            อีเวนท์
          </Link>
          <Link
            href="/account/bookings"
            className={pathname.startsWith("/account") ? "active" : ""}
          >
            <Ticket size={17} /> <span>การจองของฉัน</span>
          </Link>
          {roles.some((r) => r !== "CUSTOMER") ? (
            <Link href="/admin">จัดการระบบ</Link>
          ) : null}
        </nav>
        {session ? (
          <button
            className="button button-outline header-auth"
            onClick={async () => {
              await authClient.signOut();
              window.location.assign(new URL("/", window.location.origin).href);
            }}
          >
            <LogOut size={17} />
            <span>ออกจากระบบ</span>
          </button>
        ) : (
          <Link href="/login" className="button button-outline header-auth">
            <UserRound size={17} />
            <span>เข้าสู่ระบบ</span>
          </Link>
        )}
      </div>
    </header>
  );
}
