"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Filter,
  History,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useResource } from "@/lib/client-api";
import type { EventData, PageData } from "@/lib/client-types";
import {
  Empty,
  ErrorNotice,
  EventCard,
  Loading,
  Pagination,
} from "@/components/ui";

type TimeFilter = "upcoming" | "past" | "all";
type SortOption = "date-asc" | "date-desc";

// The 3D tilt now lives inside EventCard; this wrapper only keeps the grid styling.
function TiltCard({ children }: { children: React.ReactNode }) {
  return <div className="mongkol-event">{children}</div>;
}

function isPastEvent(event: EventData) {
  return event.status === "COMPLETED" || event.status === "CLOSED";
}

export function EventList({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("date-asc");
  const [page, setPage] = useState(1);

  const resource = useResource<PageData<EventData>>(
    `/api/events?q=${encodeURIComponent(search)}&page=${page}&pageSize=50`,
  );

  const allItems = useMemo(() => resource.data?.items ?? [], [resource.data]);

  const availableMonths = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allItems) {
      const d = new Date(item.startsAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) {
        const label = new Intl.DateTimeFormat("th-TH", {
          month: "long",
          year: "numeric",
          timeZone: "Asia/Bangkok",
        }).format(d);
        map.set(key, label);
      }
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [allItems]);

  const counts = useMemo(() => {
    let upcoming = 0;
    let past = 0;
    for (const item of allItems) {
      if (isPastEvent(item)) past += 1;
      else upcoming += 1;
    }
    return { upcoming, past, all: allItems.length };
  }, [allItems]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = allItems.filter((event) => {
      const past = isPastEvent(event);
      if (timeFilter === "upcoming" && past) return false;
      if (timeFilter === "past" && !past) return false;

      if (q) {
        const matchText =
          event.title.toLowerCase().includes(q) ||
          event.venue.toLowerCase().includes(q) ||
          event.artists?.some((a) => a.toLowerCase().includes(q));
        if (!matchText) return false;
      }

      if (monthFilter !== "ALL") {
        const d = new Date(event.startsAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key !== monthFilter) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      // When viewing "all", always prioritize upcoming events before past events
      if (timeFilter === "all") {
        const aPast = isPastEvent(a) ? 1 : 0;
        const bPast = isPastEvent(b) ? 1 : 0;
        if (aPast !== bPast) return aPast - bPast;
      }

      if (sortBy === "date-desc") {
        return Date.parse(b.startsAt) - Date.parse(a.startsAt);
      }
      // For "past" tab with default sort, show most recent past events first
      if (timeFilter === "past" && sortBy === "date-asc") {
        return Date.parse(b.startsAt) - Date.parse(a.startsAt);
      }
      return Date.parse(a.startsAt) - Date.parse(b.startsAt);
    });
  }, [allItems, timeFilter, query, monthFilter, sortBy]);

  const hasActiveFilters =
    Boolean(query.trim()) ||
    Boolean(search.trim()) ||
    timeFilter !== "upcoming" ||
    monthFilter !== "ALL" ||
    sortBy !== "date-asc";

  function resetFilters() {
    setQuery("");
    setSearch("");
    setTimeFilter("upcoming");
    setMonthFilter("ALL");
    setSortBy("date-asc");
    setPage(1);
  }

  return (
    <div className="mongkol-page customer-page">
      <section className="customer-hero">
        <div className="mongkol-container">
          <div className="section-kicker">
            <span /> EVENT LINEUP & ARCHIVE
          </div>
          <div className="mongkol-section-head" style={{ marginBottom: 0 }}>
            <div>
              <h1>ตารางอีเวนต์ทั้งหมด</h1>
              <p>
                ค้นหาอีเวนต์ที่คุณต้องการ เลือกกรองงานที่กำลังจะจัดขึ้น
                งานที่ผ่านมาแล้ว หรือเลือกตามเดือนที่จัดงานได้ทันที
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mongkol-section events-catalog-section">
        <div className="mongkol-container">
          <div className="events-filter-panel">
            <div
              className="events-time-tabs"
              role="tablist"
              aria-label="สถานะช่วงเวลาอีเวนต์"
            >
              <button
                type="button"
                role="tab"
                aria-selected={timeFilter === "upcoming"}
                className={`events-time-tab ${timeFilter === "upcoming" ? "active" : ""}`}
                onClick={() => setTimeFilter("upcoming")}
              >
                <Sparkles size={16} />
                <span>อีเวนต์ที่กำลังจะจัดขึ้น</span>
                <small>{counts.upcoming}</small>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={timeFilter === "past"}
                className={`events-time-tab ${timeFilter === "past" ? "active" : ""}`}
                onClick={() => setTimeFilter("past")}
              >
                <History size={16} />
                <span>อีเวนต์ที่ผ่านมาแล้ว</span>
                <small>{counts.past}</small>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={timeFilter === "all"}
                className={`events-time-tab ${timeFilter === "all" ? "active" : ""}`}
                onClick={() => setTimeFilter("all")}
              >
                <CalendarDays size={16} />
                <span>ทั้งหมด</span>
                <small>{counts.all}</small>
              </button>
            </div>

            <form
              className="events-search-bar"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(query.trim());
                setPage(1);
              }}
            >
              <div className="events-search-input-wrap">
                <Search size={19} className="events-search-icon" />
                <label className="sr-only" htmlFor="event-search">
                  ค้นหาอีเวนต์ ศิลปิน หรือสถานที่
                </label>
                <input
                  id="event-search"
                  type="search"
                  placeholder="ค้นหาชื่ออีเวนต์, ศิลปิน หรือสถานที่จัดงาน..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query ? (
                  <button
                    type="button"
                    className="events-search-clear"
                    onClick={() => {
                      setQuery("");
                      if (search) setSearch("");
                    }}
                    aria-label="ล้างคำค้นหา"
                  >
                    <X size={15} />
                  </button>
                ) : null}
              </div>
              <button className="mongkol-button" type="submit">
                <Search size={17} />
                <span>ค้นหา</span>
              </button>
            </form>

            <div className="events-subfilters">
              <div className="events-filter-meta">
                <p>
                  <Filter size={14} /> แสดง{" "}
                  <strong>{filteredEvents.length}</strong> รายการ
                  {timeFilter === "upcoming"
                    ? " (อีเวนต์ที่กำลังจะจัดขึ้น)"
                    : timeFilter === "past"
                      ? " (อีเวนต์ที่ผ่านมาแล้ว)"
                      : " (รวมทุกสถานะ)"}
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    className="events-reset-btn"
                    onClick={resetFilters}
                  >
                    <RotateCcw size={14} /> ล้างตัวกรองทั้งหมด
                  </button>
                ) : null}
              </div>

              <div className="events-select-group">
                <label className="events-filter-select">
                  <CalendarDays size={15} />
                  <span className="sr-only">เลือกเดือน</span>
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    aria-label="กรองตามเดือนที่จัดงาน"
                  >
                    <option value="ALL">ทุกเดือน</option>
                    {availableMonths.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="events-filter-select">
                  <Clock3 size={15} />
                  <span className="sr-only">เรียงวันที่จัด</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    aria-label="เรียงวันที่จัดอีเวนต์"
                  >
                    <option value="date-asc">เรียง: วันจัดงานใกล้สุด</option>
                    <option value="date-desc">เรียง: วันจัดงานไกลสุด / ล่าสุด</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <ErrorNotice error={resource.error} retry={resource.reload} />
          {resource.loading ? (
            <Loading />
          ) : filteredEvents.length ? (
            <>
              <div className="mongkol-event-grid">
                {filteredEvents.map((event) => (
                  <TiltCard key={event.id}>
                    <EventCard event={event} />
                  </TiltCard>
                ))}
              </div>
              {resource.data && resource.data.total > resource.data.pageSize ? (
                <Pagination {...resource.data} onChange={setPage} />
              ) : null}
            </>
          ) : !resource.error ? (
            <Empty
              title={
                timeFilter === "past"
                  ? "ยังไม่มีอีเวนต์ที่ผ่านมาแล้วในหมวดนี้"
                  : "ไม่พบอีเวนต์ที่ตรงกับตัวกรอง"
              }
            >
              <p>ลองเปลี่ยนคำค้นหา หรือสลับดูตัวกรองสถานะอีเวนต์อื่น</p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="mongkol-button"
                  style={{ marginTop: 18 }}
                  onClick={resetFilters}
                >
                  <RotateCcw size={16} /> แสดงอีเวนต์ที่กำลังจะจัดขึ้นทั้งหมด
                </button>
              ) : null}
            </Empty>
          ) : null}
        </div>
      </section>
    </div>
  );
}
