"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Pencil, Map } from "lucide-react";
import { useMutation, useResource } from "@/lib/client-api";
import type { EventData, PageData } from "@/lib/client-types";
import {
  dateTime,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  PageHeading,
  Pagination,
  Status,
} from "@/components/ui";
export function AdminEvents() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const events = useResource<PageData<EventData>>(
    `/api/admin/events?page=${page}&pageSize=15&q=${encodeURIComponent(q)}`,
  );
  return (
    <>
      <PageHeading
        title="อีเวนท์และผังสถานที่"
        description="จัดการรอบแสดง หน่วยขาย และผังของแต่ละอีเวนท์"
        action={
          <Link href="/admin/events/new" className="button">
            <Plus size={17} />
            สร้างอีเวนท์
          </Link>
        }
      />
      <div className="filter-bar">
        <Field label="ค้นหาชื่องาน">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="ชื่ออีเวนท์"
          />
        </Field>
      </div>
      <ErrorNotice error={events.error} retry={events.reload} />
      {events.loading ? (
        <Loading />
      ) : events.data?.items.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>อีเวนท์</th>
                  <th>วันแสดง</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {events.data.items.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.title}</strong>
                      <small>{event.venue}</small>
                    </td>
                    <td>{dateTime(event.startsAt)}</td>
                    <td>
                      <Status value={event.status} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          className="button button-outline button-small"
                          href={`/admin/events/${event.id}`}
                        >
                          <Pencil size={14} />
                          รายละเอียด
                        </Link>
                        <Link
                          className="button button-subtle button-small"
                          href={`/admin/events/${event.id}/layout`}
                        >
                          <Map size={14} />
                          ผัง
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...events.data} onChange={setPage} />
        </>
      ) : !events.error ? (
        <Empty title="ยังไม่มีอีเวนท์">
          <Link href="/admin/events/new" className="button">
            สร้างอีเวนท์แรก
          </Link>
        </Empty>
      ) : null}
    </>
  );
}
const dateInput = (value?: string) =>
  value
    ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16)
    : "";
function EventForm({ event }: { event?: EventData }) {
  const router = useRouter();
  const mutation = useMutation();
  const fields = ["title", "slug", "venue", "posterUrl"] as const;
  const labels = {
    title: "ชื่ออีเวนท์",
    slug: "ชื่อในลิงก์ (ภาษาอังกฤษ)",
    venue: "สถานที่",
    posterUrl: "URL ภาพโปสเตอร์",
  };
  return (
    <form
      className="panel stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const payload = {
          title: String(form.get("title")),
          slug: String(form.get("slug")),
          description: String(form.get("description")),
          artists: String(form.get("artists"))
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          venue: String(form.get("venue")),
          posterUrl: String(form.get("posterUrl")),
          startsAt: new Date(`${form.get("startsAt")}+07:00`).toISOString(),
          endsAt: new Date(`${form.get("endsAt")}+07:00`).toISOString(),
          saleStartsAt: new Date(
            `${form.get("saleStartsAt")}+07:00`,
          ).toISOString(),
          saleEndsAt: new Date(`${form.get("saleEndsAt")}+07:00`).toISOString(),
          ...(event ? { version: event.version } : {}),
        };
        try {
          const result = await mutation.run<EventData>(
            event ? `/api/admin/events/${event.id}` : "/api/admin/events",
            payload,
            event ? "PATCH" : "POST",
          );
          router.push(`/admin/events/${result.id}`);
          router.refresh();
        } catch {}
      }}
    >
      <div className="form-grid">
        {fields.map((field) => (
          <Field
            key={field}
            label={labels[field]}
            hint={
              field === "posterUrl"
                ? "ใช้ HTTPS หรือไฟล์ในเว็บไซต์ เช่น /concert-hero.png"
                : undefined
            }
          >
            <input
              name={field}
              required={field !== "posterUrl"}
              defaultValue={event?.[field] || ""}
              maxLength={field === "title" ? 160 : 500}
            />
          </Field>
        ))}
        <div className="full">
          <Field label="ศิลปิน (คั่นด้วยเครื่องหมายจุลภาค)">
            <input
              name="artists"
              defaultValue={event?.artists.join(", ") || ""}
            />
          </Field>
        </div>
        <div className="full">
          <Field label="รายละเอียดงาน">
            <textarea
              name="description"
              defaultValue={event?.description || ""}
              maxLength={10000}
            />
          </Field>
        </div>
        {(
          [
            { name: "startsAt", label: "เริ่มแสดง" },
            { name: "endsAt", label: "สิ้นสุดการแสดง" },
            { name: "saleStartsAt", label: "เริ่มขาย" },
            { name: "saleEndsAt", label: "สิ้นสุดการขาย" },
          ] as const
        ).map((field) => (
          <Field key={field.name} label={`${field.label} (เวลาไทย)`}>
            <input
              name={field.name}
              type="datetime-local"
              required
              defaultValue={dateInput(event?.[field.name])}
            />
          </Field>
        ))}
      </div>
      <ErrorNotice error={mutation.error} />
      <div className="actions">
        <button type="submit" className="button" disabled={mutation.pending}>
          {mutation.pending ? "กำลังบันทึก" : "บันทึกอีเวนท์"}
        </button>
        <Link href="/admin/events" className="button button-outline">
          กลับไปรายการ
        </Link>
      </div>
    </form>
  );
}
export function EventEditor({ id }: { id?: string }) {
  const resource = useResource<EventData>(
    id ? `/api/admin/events/${id}` : null,
  );
  const action = useMutation();
  const event = resource.data;
  const [reason, setReason] = useState("");
  if (id && resource.loading) return <Loading />;
  return (
    <>
      <PageHeading
        title={event ? event.title : "สร้างอีเวนท์"}
        description="หนึ่งอีเวนท์เท่ากับหนึ่งรอบการแสดง"
        action={event ? <Status value={event.status} /> : null}
      />
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {event ? (
        <>
          <div className="tabs-links">
            <Link href={`/admin/events/${id}`}>รายละเอียดงาน</Link>
            <Link href={`/admin/events/${id}/inventory`}>โซนและหน่วยขาย</Link>
            <Link href={`/admin/events/${id}/layout`}>แก้ไขผัง</Link>
            <Link href={`/events/${event.slug}`}>หน้าลูกค้า</Link>
          </div>
          <div className="panel stack-sm" style={{ marginBottom: 25 }}>
            <h3>สถานะการขาย</h3>
            <p className="muted">
              ก่อนเปิดขาย ต้องมีโซน หน่วยขาย และผังที่เผยแพร่แล้ว
              การยกเลิกงานจะยกเลิกรายการจองและสร้างรายการคืนเงินที่เกี่ยวข้อง
            </p>
            <Field label="เหตุผลการเปลี่ยนสถานะ">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={3}
                placeholder="ระบุเหตุผลเพื่อบันทึกประวัติ"
              />
            </Field>
            <ErrorNotice error={action.error} />
            <div className="actions">
              {[
                {
                  name: "publish",
                  label: "เปิดขาย",
                  show: ["DRAFT", "CLOSED"].includes(event.status),
                },
                {
                  name: "close",
                  label: "ปิดการขาย",
                  show: event.status === "PUBLISHED",
                },
                {
                  name: "cancel",
                  label: "ยกเลิกงาน",
                  show: !["CANCELLED", "COMPLETED"].includes(event.status),
                },
              ]
                .filter((a) => a.show)
                .map((a) => (
                  <button
                    key={a.name}
                    className={`button ${a.name === "cancel" ? "button-danger" : "button-outline"}`}
                    disabled={reason.trim().length < 3 || action.pending}
                    onClick={async () => {
                      if (
                        a.name === "cancel" &&
                        !window.confirm(
                          "ยกเลิกอีเวนท์นี้และรายการจองทั้งหมด? เงินที่รับแล้วจะเข้าคิวคืนเงิน",
                        )
                      )
                        return;
                      try {
                        await action.run(
                          `/api/admin/events/${event.id}/${a.name}`,
                          { version: event.version, reason },
                        );
                        await resource.reload();
                      } catch {}
                    }}
                  >
                    {a.label}
                  </button>
                ))}
            </div>
          </div>
        </>
      ) : null}
      {!id || event ? (
        <EventForm key={event?.version || "new"} event={event || undefined} />
      ) : null}
    </>
  );
}
