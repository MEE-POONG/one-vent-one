"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const menuItems = [["หน้าแรก", "/"], ["อีเวนต์", "/#events"], ["ศิลปิน", "/#events"], ["แกลเลอรี่", "/#events"], ["ติดต่อเรา", "#contact"], ["ตรวจสอบการจอง", "/account/bookings"]];

export function SiteHeader() {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles || [];
  return <header className="site-header mongkol-header">
    <div className="header-inner">
      <Link href="/" className="brand mongkol-brand" aria-label="Mongkol Bar หน้าแรก"><Image src="/mongkol-logo.png" alt="Mongkol Bar" width={180} height={60} priority /></Link>
      <nav aria-label="เมนูหลัก"><Link href="/">หน้าแรก</Link><Link href="/#events" className={pathname.startsWith("/events") ? "active" : ""}>อีเวนต์</Link><Link href="/#events">ศิลปิน</Link><Link href="/#events">แกลเลอรี่</Link><Link href="/#contact">ติดต่อเรา</Link>{roles.some((r) => r !== "CUSTOMER") ? <Link href="/admin">จัดการระบบ</Link> : null}</nav>
      <Link className="header-search" href="/#events" aria-label="ค้นหาอีเวนต์"><Search size={19} /></Link>
      {session ? <button className="button button-outline header-auth" onClick={async () => { await authClient.signOut(); window.location.assign(new URL("/", window.location.origin).href); }}><LogOut size={17} /><span>ออกจากระบบ</span></button> : <Link href="/login" className="button button-outline header-auth"><UserRound size={17} /><span>เข้าสู่ระบบ</span></Link>}
      <button className="header-menu" onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู"><Menu size={21} /></button>
    </div>
    <aside className={`mobile-menu ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen}><button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู"><X size={22} /></button><Link className="menu-logo" href="/" onClick={() => setMenuOpen(false)}>OneVent<span>One</span></Link>{menuItems.map(([name, href], index) => <Link key={name} href={href} onClick={() => setMenuOpen(false)}><span>{name}</span><small>{String(index + 1).padStart(2, "0")}</small></Link>)}<Link className="menu-login" href={session ? "/account/bookings" : "/login"} onClick={() => setMenuOpen(false)}><UserRound size={17} />{session ? "การจองของฉัน" : "เข้าสู่ระบบ / สมัครสมาชิก"}</Link></aside>
    {menuOpen ? <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู" /> : null}
  </header>;
}
