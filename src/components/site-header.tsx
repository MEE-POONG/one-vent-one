"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, LogOut, MapPin, Menu, Search, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { EventData, PageData } from "@/lib/client-types";
import { dateTime } from "@/components/ui";

const menuItems = [["หน้าแรก", "/"], ["อีเวนต์", "/#events"], ["ติดต่อเรา", "/#contact"], ["ตรวจสอบการจอง", "/account/bookings"]];

export function SiteHeader() {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<EventData[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles || [];

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res = await fetch(`/api/events?q=${encodeURIComponent(searchQuery.trim())}&page=1&pageSize=5`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as { data?: PageData<EventData> };
        if (json?.data?.items) setResults(json.data.items);
      } catch {
        // Ignore abort errors
      } finally {
        setLoadingSearch(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchOpen, searchQuery]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    setSearchOpen(false);
    router.push(q ? `/events?q=${encodeURIComponent(q)}` : "/events");
  }

  return <header className="site-header mongkol-header">
    <div className="header-inner">
      <Link href="/" className="brand mongkol-brand" aria-label="Mongkol Bar หน้าแรก"><Image src="/mongkol-logo.png" alt="Mongkol Bar" width={180} height={60} priority /></Link>
      <nav aria-label="เมนูหลัก">
        <Link href="/">หน้าแรก</Link>
        <Link href="/#events">อีเวนต์</Link>
        <Link href="/#contact">ติดต่อเรา</Link>
        {roles.some((r) => r !== "CUSTOMER") ? <Link href="/admin">จัดการระบบ</Link> : null}
      </nav>
      <div className="header-actions">
        <button
          type="button"
          className={`header-search ${searchOpen ? "is-open" : ""}`}
          onClick={() => setSearchOpen((prev) => !prev)}
          aria-label="ค้นหาอีเวนต์"
          aria-expanded={searchOpen}
        >
          {searchOpen ? <X size={19} /> : <Search size={19} />}
        </button>
        {session ? <button className="button button-outline header-auth" onClick={async () => { await authClient.signOut(); window.location.assign(new URL("/", window.location.origin).href); }}><LogOut size={17} /><span>ออกจากระบบ</span></button> : <Link href="/login" className="button button-outline header-auth"><UserRound size={17} /><span>เข้าสู่ระบบ</span></Link>}
        <button className="header-menu" onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู"><Menu size={21} /></button>
      </div>
    </div>
    {searchOpen ? (
      <>
        <div className="header-search-panel" role="dialog" aria-label="ค้นหาอีเวนต์">
          <div className="mongkol-container">
            <form className="header-search-form" onSubmit={handleSearchSubmit}>
              <Search size={20} className="header-search-icon" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่ออีเวนต์, ศิลปิน หรือสถานที่จัดงาน..."
                aria-label="ค้นหาอีเวนต์"
              />
              {searchQuery ? (
                <button type="button" className="header-search-clear" onClick={() => setSearchQuery("")} aria-label="ล้างคำค้นหา">
                  <X size={16} />
                </button>
              ) : null}
              <button type="submit" className="mongkol-button header-search-submit">
                ค้นหา <ArrowRight size={16} />
              </button>
            </form>
            <div className="header-search-results">
              {loadingSearch ? (
                <p className="header-search-status">กำลังค้นหาอีเวนต์...</p>
              ) : results.length ? (
                <div className="header-search-list">
                  {results.map((event) => (
                    <Link
                      key={event.id}
                      href={`/events/${event.slug}`}
                      className="header-search-item"
                      onClick={() => setSearchOpen(false)}
                    >
                      <Image
                        src={event.posterUrl || "/concert-hero.png"}
                        alt=""
                        width={48}
                        height={64}
                        unoptimized={!!event.posterUrl?.startsWith("https:")}
                      />
                      <div className="header-search-item-info">
                        <strong>{event.title}</strong>
                        <span><CalendarDays size={13} /> {dateTime(event.startsAt)}</span>
                        <span><MapPin size={13} /> {event.venue}</span>
                      </div>
                      <ArrowRight size={16} className="header-search-item-arrow" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="header-search-status">ไม่พบอีเวนต์ที่ตรงกับ “{searchQuery}”</p>
              )}
            </div>
          </div>
        </div>
        <button className="search-backdrop" onClick={() => setSearchOpen(false)} aria-label="ปิดหน้าต่างค้นหา" />
      </>
    ) : null}
    <aside className={`mobile-menu ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen}><button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู"><X size={22} /></button><Link className="menu-logo" href="/" onClick={() => setMenuOpen(false)}>OneVent<span>One</span></Link>{menuItems.map(([name, href], index) => <Link key={name} href={href} onClick={() => setMenuOpen(false)}><span>{name}</span><small>{String(index + 1).padStart(2, "0")}</small></Link>)}<Link className="menu-login" href={session ? "/account/bookings" : "/login"} onClick={() => setMenuOpen(false)}><UserRound size={17} />{session ? "การจองของฉัน" : "เข้าสู่ระบบ / สมัครสมาชิก"}</Link></aside>
    {menuOpen ? <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู" /> : null}
  </header>;
}
