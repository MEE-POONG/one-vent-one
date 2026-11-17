"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useResource } from "@/lib/client-api";
import type { EventData, VenueLayout } from "@/lib/client-types";
import { ErrorNotice, Loading, PageHeading } from "@/components/ui";
const LayoutCanvas = dynamic(() => import("./layout-canvas"), {
  ssr: false,
  loading: () => <Loading label="กำลังเปิดเครื่องมือผัง" />,
});
export function LayoutEditor({ eventId }: { eventId: string }) {
  const resource = useResource<VenueLayout>(
    `/api/admin/events/${eventId}/layout`,
  );
  const event = useResource<EventData>(`/api/admin/events/${eventId}`);
  return (
    <>
      <PageHeading
        title="ผังสถานที่"
        description={`${event.data?.title || ""} · แก้ไขร่าง บันทึก แล้วเผยแพร่เวอร์ชันใหม่`}
      />
      <div className="tabs-links">
        <Link href={`/admin/events/${eventId}`}>รายละเอียดงาน</Link>
        <Link href={`/admin/events/${eventId}/inventory`}>จัดการโต๊ะและราคา</Link>
        <Link href={`/admin/events/${eventId}/layout`}>แก้ไขผัง</Link>
      </div>
      <ErrorNotice
        error={resource.error || event.error}
        retry={resource.reload}
      />
      {resource.loading || event.loading ? (
        <Loading />
      ) : resource.data && event.data ? (
        <LayoutCanvas
          eventId={eventId}
          initial={resource.data}
          event={event.data}
          onEventReload={event.reload}
        />
      ) : null}
    </>
  );
}
