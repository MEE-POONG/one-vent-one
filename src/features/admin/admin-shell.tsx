"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ScanLine,
  Settings2,
  Users,
  History,
  ChartNoAxesCombined,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Empty, Loading } from "@/components/ui";
import { isStaff, rolesOf } from "@/lib/roles";
// ADMIN runs daily operations; only the owner (SUPER_ADMIN) manages staff,
// shop settings and the audit log. The server enforces the same split.
const STAFF = ["SUPER_ADMIN", "ADMIN"];
const OWNER = ["SUPER_ADMIN"];
const nav = [
  {
    href: "/admin",
    label: "ภาพรวม",
    icon: LayoutDashboard,
    roles: STAFF,
  },
  {
    href: "/admin/events",
    label: "อีเวนท์และผัง",
    icon: CalendarDays,
    roles: STAFF,
  },
  {
    href: "/admin/bookings",
    label: "รายการจอง",
    icon: ClipboardList,
    roles: STAFF,
  },
  {
    href: "/admin/reports",
    label: "รายงาน",
    icon: ChartNoAxesCombined,
    roles: STAFF,
  },
  {
    href: "/admin/check-in",
    label: "ตรวจบัตรเข้างาน",
    icon: ScanLine,
    roles: STAFF,
  },
  {
    href: "/admin/staff",
    label: "เจ้าหน้าที่และสิทธิ์",
    icon: Users,
    roles: OWNER,
  },
  {
    href: "/admin/settings",
    label: "ตั้งค่าร้าน",
    icon: Settings2,
    roles: OWNER,
  },
  {
    href: "/admin/audit",
    label: "ประวัติการทำรายการ",
    icon: History,
    roles: OWNER,
  },
];
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const roles = rolesOf(session);
  if (isPending) return <Loading />;
  if (!session)
    return (
      <div className="container section">
        <Empty title="เข้าสู่ระบบสำหรับเจ้าหน้าที่">
          <Link
            className="button"
            href={`/login?next=${encodeURIComponent(pathname)}`}
          >
            เข้าสู่ระบบ
          </Link>
        </Empty>
      </div>
    );
  if (!isStaff(roles))
    return (
      <div className="container section">
        <Empty title="บัญชีนี้ไม่มีสิทธิ์จัดการระบบ">
          <p>ติดต่อผู้ดูแลร้านเพื่อขอสิทธิ์ที่เหมาะสม</p>
          <Link href="/events" className="button button-outline">
            กลับไปดูอีเวนท์
          </Link>
        </Empty>
      </div>
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <p>พื้นที่สำหรับเจ้าหน้าที่</p>
        <nav aria-label="จัดการระบบ">
          {nav
            .filter((item) => item.roles.some((role) => roles.includes(role)))
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  (
                    item.href === "/admin"
                      ? pathname === item.href
                      : pathname.startsWith(item.href)
                  )
                    ? "active"
                    : ""
                }
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            ))}
        </nav>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}
