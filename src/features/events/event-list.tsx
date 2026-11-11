"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { useResource } from "@/lib/client-api";
import type { EventData, PageData } from "@/lib/client-types";
import {
  Empty,
  ErrorNotice,
  EventCard,
  Loading,
  PageHeading,
  Pagination,
} from "@/components/ui";
export function EventList({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const resource = useResource<PageData<EventData>>(
    `/api/events?q=${encodeURIComponent(search)}&page=${page}&pageSize=12`,
  );
  return (
    <div className="container section">
      <PageHeading
        title="เลือกคืนพิเศษของคุณ"
        description="ค้นหาอีเวนท์ ดูผัง และเลือกโต๊ะ ที่นั่ง หรือบัตรเข้าชม"
      />
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
          setPage(1);
        }}
      >
        <label className="sr-only" htmlFor="event-search">
          ค้นหาอีเวนท์หรือสถานที่
        </label>
        <input
          className="input"
          id="event-search"
          placeholder="ค้นหาอีเวนท์หรือสถานที่"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="button" type="submit">
          <Search size={18} />
          <span>ค้นหา</span>
        </button>
      </form>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.items.length ? (
        <>
          <div className="event-list">
            {resource.data.items.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          <Pagination {...resource.data} onChange={setPage} />
        </>
      ) : !resource.error ? (
        <Empty title="ไม่พบอีเวนท์ที่ค้นหา">
          <p>ลองเปลี่ยนคำค้น หรือกลับมาดูใหม่ภายหลัง</p>
        </Empty>
      ) : null}
    </div>
  );
}
