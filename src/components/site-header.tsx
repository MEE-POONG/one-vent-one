"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, LogOut, MapPin, Menu, Search, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { isStaff, rolesOf } from "@/lib/roles";
import type { EventData, PageData } from "@/lib/client-types";
import { dateTime } from "@/components/ui";
import { oneVentOneLogo } from "@/shared/images";

const menuItems = [
  ["หน้าแรก", "/", "home"],
  ["อีเวนต์", "/#events", "events"],
  ["ติดต่อเรา", "/#contact", "contact"],
  ["ตรวจสอบการจอง", "/account/bookings", ""],
] as const;

export function SiteHeader({
  businessName = "Mongkol Bar",
  logo = null,
}: {
  businessName?: string;
  logo?: string | null;
}) {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<EventData[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const roles = rolesOf(session);

  function navigateToSection(
    e: MouseEvent<HTMLAnchorElement>,
    sectionId: "home" | "events" | "contact",
  ) {
    e.preventDefault();
    setMenuOpen(false);
    setSearchOpen(false);
    const targetHref = sectionId === "home" ? "/" : `/#${sectionId}`;

    if (pathname === "/") {
      window.history.pushState(null, "", targetHref);
      if (sectionId === "home") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        document
          .getElementById(sectionId)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    try {
      window.sessionStorage.setItem("oneventone_scroll_target", sectionId);
    } catch {
      // Ignore storage errors
    }
    router.push(targetHref, { scroll: false });
  }

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
      <Link
        href="/"
        className="brand mongkol-brand"
        aria-label={`${businessName} หน้าแรก`}
        onClick={(e) => navigateToSection(e, "home")}
      >
        {logo ? (
          <Image
            src={logo}
            alt={`โลโก้ ${businessName}`}
            width={180}
            height={60}
            unoptimized
            priority
            style={{ objectFit: logo === oneVentOneLogo ? "cover" : "contain" }}
          />
        ) : businessName}
      </Link>
      <nav aria-label="เมนูหลัก">
        <Link href="/" onClick={(e) => navigateToSection(e, "home")}>หน้าแรก</Link>
        <Link href="/#events" onClick={(e) => navigateToSection(e, "events")}>อีเวนต์</Link>
        <Link href="/#contact" onClick={(e) => navigateToSection(e, "contact")}>ติดต่อเรา</Link>
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
        <button className="header-menu" onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู" aria-expanded={menuOpen} aria-controls="site-menu"><Menu size={21} /></button>
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
                        height={72}
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
    <aside id="site-menu" className={`mobile-menu ${menuOpen ? "open" : ""}`} aria-label="เมนูหลัก" aria-hidden={!menuOpen} inert={!menuOpen}>
      <div className="menu-top">
        <Link
          className="menu-logo"
          href="/"
          aria-label={`${businessName} หน้าแรก`}
          onClick={(e) => navigateToSection(e, "home")}
        >
          {logo ? (
            <Image
              src={logo}
              alt={`โลโก้ ${businessName}`}
              width={180}
              height={60}
              unoptimized
              style={{ objectFit: logo === oneVentOneLogo ? "cover" : "contain" }}
            />
          ) : businessName}
        </Link>
        <button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู"><X size={20} /></button>
      </div>
      <div className="menu-links">
        {menuItems.map(([name, href, sectionId]) => (
          <Link
            key={name}
            href={href}
            aria-current={(href === "/" ? pathname === "/" : !sectionId && pathname.startsWith(href)) ? "page" : undefined}
            onClick={(e) => sectionId ? navigateToSection(e, sectionId) : setMenuOpen(false)}
          >
            <span>{name}</span><ArrowRight size={18} aria-hidden="true" />
          </Link>
        ))}
        {/* Back office: owner (SUPER_ADMIN) and staff (ADMIN) only. The server hides /admin from everyone else regardless. */}
        {isStaff(roles) ? (
          <div className="menu-staff">
            <Link
              href="/admin"
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <span>จัดการระบบ</span><ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>
      <Link className="menu-login" href={session ? "/account" : "/login"} onClick={() => setMenuOpen(false)}><UserRound size={17} />{session ? "โปรไฟล์ของฉัน" : "เข้าสู่ระบบ / สมัครสมาชิก"}</Link>
    </aside>
    {menuOpen ? <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู" /> : null}
  </header>;
}
