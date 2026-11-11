"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Pencil, Map, Copy, Trash2 } from "lucide-react";
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
  statusText,
} from "@/components/ui";

const EVENT_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "CLOSED",
  "CANCELLED",
  "COMPLETED",
] as const;

export function AdminEvents() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const events = useResource<PageData<EventData>>(
    `/api/admin/events?page=${page}&pageSize=15&q=${encodeURIComponent(q)}${status ? `&status=${status}` : ""}`,
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
        <Field label="สถานะ">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">ทุกสถานะ</option>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusText(s)}
              </option>
            ))}
          </select>
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
                  <th>การจอง</th>
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
                    <td>{event._count?.bookings ?? 0}</td>
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
                        <Link
                          className="button button-subtle button-small"
                          href={`/admin/events/new?from=${event.id}`}
                          title="สร้างงานใหม่โดยคัดลอกโซน หน่วยขาย ราคา และผัง"
                        >
                          <Copy size={14} />
                          ทำซ้ำ
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
        <Empty title={q || status ? "ไม่พบอีเวนท์ที่ค้นหา" : "ยังไม่มีอีเวนท์"}>
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

/**
 * `event` = edit an existing event. `template` = create a new draft that copies the
 * template's zones, units, prices and layout. Neither = blank new event.
 */
function EventForm({
  event,
  template,
}: {
  event?: EventData;
  template?: EventData;
}) {
  const router = useRouter();
  const mutation = useMutation();
  const initial: Partial<EventData> | undefined =
    event ??
    (template && {
      ...template,
      title: `${template.title} (รอบใหม่)`.slice(0, 160),
      slug: `${template.slug}-2`.slice(0, 100),
    });
  const fields = ["title", "slug", "venue", "posterUrl"] as const;
  const labels = {
    title: "ชื่ออีเวนท์",
    slug: "ชื่อในลิงก์ (ภาษาอังกฤษ)",
    venue: "สถานที่",
    posterUrl: "URL ภาพโปสเตอร์",
  };
  const hints: Partial<Record<(typeof fields)[number], string>> = {
    slug: "a-z, 0-9 และ - เท่านั้น ต้องไม่ซ้ำกับงานอื่น",
    posterUrl: "ใช้ HTTPS หรือไฟล์ในเว็บไซต์ เช่น /concert-hero.png",
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
            event
              ? `/api/admin/events/${event.id}`
              : template
                ? `/api/admin/events/${template.id}/duplicate`
                : "/api/admin/events",
            payload,
            event ? "PATCH" : "POST",
          );
          router.push(`/admin/events/${result.id}`);
          router.refresh();
        } catch {}
      }}
    >
      {template ? (
        <div className="notice">
          คัดลอกโซน หน่วยขาย ราคา ประเภทบัตร และผังร่างจาก “{template.title}”
          เป็นงานฉบับร่างใหม่ (ไม่คัดลอกการจอง)
          ช่วงขายของประเภทบัตรจะเลื่อนตามวันเริ่มแสดงใหม่
          อย่าลืมแก้วันเวลาให้ตรงกับรอบใหม่ แล้วเผยแพร่ผังก่อนเปิดขาย
        </div>
      ) : null}
      <div className="form-grid">
        {fields.map((field) => (
          <Field key={field} label={labels[field]} hint={hints[field]}>
            <input
              name={field}
              required={field !== "posterUrl"}
              defaultValue={initial?.[field] || ""}
              maxLength={field === "title" ? 160 : field === "slug" ? 100 : 500}
              pattern={field === "slug" ? "[a-z0-9]+(-[a-z0-9]+)*" : undefined}
            />
          </Field>
        ))}
        <div className="full">
          <Field label="ศิลปิน (คั่นด้วยเครื่องหมายจุลภาค)">
            <input
              name="artists"
              defaultValue={initial?.artists?.join(", ") || ""}
            />
          </Field>
        </div>
        <div className="full">
          <Field label="รายละเอียดงาน">
            <textarea
              name="description"
              defaultValue={initial?.description || ""}
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
              defaultValue={dateInput(initial?.[field.name])}
            />
          </Field>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        สิ้นสุดการขายต้องไม่เกินเวลาสิ้นสุดการแสดง
      </p>
      <ErrorNotice error={mutation.error} />
      <div className="actions">
        <button type="submit" className="button" disabled={mutation.pending}>
          {mutation.pending
            ? "กำลังบันทึก"
            : template
              ? "สร้างงานจากต้นฉบับ"
              : "บันทึกอีเวนท์"}
        </button>
        <Link href="/admin/events" className="button button-outline">
          กลับไปรายการ
        </Link>
      </div>
    </form>
  );
}

type CancelResult = {
  processed: number;
  remaining: number;
  failedBookingIds: string[];
  pendingRefundCount: number;
  complete: boolean;
};

function Readiness({ event }: { event: EventData }) {
  const checks = [
    { ok: (event.zones?.length ?? 0) > 0, label: "มีโซนอย่างน้อย 1 โซน" },
    {
      ok:
        (event.units?.some((u) => u.active) ?? false) ||
        (event.ticketTypes?.some((t) => t.active) ?? false),
      label: "มีหน่วยขายหรือประเภทบัตรที่เปิดขาย",
    },
    {
      ok: Boolean(event.publishedLayoutVersion),
      label: "เผยแพร่ผังแล้ว (ถ้าแก้ผังหรือเพิ่มหน่วยขาย ต้องเผยแพร่ผังใหม่)",
    },
    {
      ok: Date.parse(event.saleEndsAt) > Date.parse(event.serverNow ?? ""),
      label: "ช่วงขายยังไม่สิ้นสุด",
    },
  ];
  return (
    <ul className="stack-sm" style={{ listStyle: "none", padding: 0 }}>
      {checks.map((c) => (
        <li key={c.label} className={c.ok ? "" : "muted"}>
          {c.ok ? "✓" : "✗"} {c.label}
        </li>
      ))}
    </ul>
  );
}

export function EventEditor({ id, from }: { id?: string; from?: string }) {
  const router = useRouter();
  const resource = useResource<EventData>(
    id || from ? `/api/admin/events/${id ?? from}` : null,
  );
  const action = useMutation();
  const loaded = resource.data;
  const event = id ? loaded : null;
  const template = !id && from ? loaded : null;
  const [reason, setReason] = useState("");
  const [progress, setProgress] = useState("");
  if ((id || from) && resource.loading) return <Loading />;

  async function cancelEvent(current: EventData) {
    // The server cancels 25 bookings per call; keep calling until none remain.
    setProgress("");
    try {
      for (let round = 0; round < 400; round++) {
        const result = await action.run<CancelResult>(
          `/api/admin/events/${current.id}/cancel`,
          { version: current.version, reason },
        );
        setProgress(
          result.complete
            ? `ยกเลิกครบทุกรายการแล้ว รอคืนเงิน ${result.pendingRefundCount} รายการ`
            : `กำลังยกเลิก… เหลือ ${result.remaining} รายการ`,
        );
        if (result.complete) break;
        if (result.processed === 0) {
          setProgress(
            `ยกเลิกไม่สำเร็จ ${result.failedBookingIds.length} รายการ เหลือ ${result.remaining} รายการ กดดำเนินการต่ออีกครั้ง`,
          );
          break;
        }
      }
    } catch {}
    await resource.reload();
  }

  const activeBookings = event?.activeBookingCount ?? 0;
  const bookings = event?.bookingCount ?? 0;
  const ended = event
    ? Date.parse(event.endsAt) <= Date.parse(event.serverNow ?? "")
    : false;
  const statusActions = event
    ? [
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
          name: "draft",
          label: "กลับเป็นฉบับร่าง (แก้โครงสร้าง)",
          show: event.status === "CLOSED" && activeBookings === 0,
        },
        {
          name: "complete",
          label: "สิ้นสุดงาน",
          show: ["PUBLISHED", "CLOSED"].includes(event.status) && ended,
        },
        {
          name: "cancel",
          label: "ยกเลิกงาน",
          show: !["CANCELLED", "COMPLETED"].includes(event.status),
        },
        {
          name: "cancel",
          label: "ดำเนินการยกเลิกต่อ",
          show: event.status === "CANCELLED" && !event.cancellationProcessedAt,
        },
      ].filter((a) => a.show)
    : [];

  return (
    <>
      <PageHeading
        title={
          event
            ? event.title
            : template
              ? `ทำซ้ำจาก ${template.title}`
              : "สร้างอีเวนท์"
        }
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
            <Link href={`/admin/events/new?from=${id}`}>ทำซ้ำเป็นรอบใหม่</Link>
          </div>
          <div className="panel stack-sm" style={{ marginBottom: 25 }}>
            <h3>สถานะการขาย</h3>
            <p className="muted">
              การจองทั้งหมด {bookings} รายการ (ใช้งานอยู่ {activeBookings})
              การยกเลิกงานจะยกเลิกรายการจองและสร้างรายการคืนเงินที่เกี่ยวข้อง
            </p>
            {["DRAFT", "CLOSED"].includes(event.status) ? (
              <>
                <strong>ความพร้อมก่อนเปิดขาย</strong>
                <Readiness event={event} />
              </>
            ) : null}
            {event.status === "PUBLISHED" ? (
              <p className="muted">
                ต้องการเพิ่ม/ลบโซนหรือหน่วยขาย: ปิดการขายก่อน แล้วกด
                “กลับเป็นฉบับร่าง” (ทำได้เมื่อไม่มีการจองที่ใช้งานอยู่)
              </p>
            ) : null}
            <Field label="เหตุผลการเปลี่ยนสถานะ">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={3}
                placeholder="ระบุเหตุผลเพื่อบันทึกประวัติ (อย่างน้อย 3 ตัวอักษร)"
              />
            </Field>
            <ErrorNotice error={action.error} />
            {progress ? (
              <p role="status" className="notice">
                {progress}
              </p>
            ) : null}
            <div className="actions">
              {statusActions.map((a) => (
                <button
                  key={a.label}
                  className={`button ${a.name === "cancel" ? "button-danger" : "button-outline"}`}
                  disabled={reason.trim().length < 3 || action.pending}
                  onClick={async () => {
                    if (a.name === "cancel") {
                      if (
                        event.status !== "CANCELLED" &&
                        !window.confirm(
                          "ยกเลิกอีเวนท์นี้และรายการจองทั้งหมด? เงินที่รับแล้วจะเข้าคิวคืนเงิน",
                        )
                      )
                        return;
                      await cancelEvent(event);
                      return;
                    }
                    try {
                      await action.run(
                        `/api/admin/events/${event.id}/${a.name}`,
                        { version: event.version, reason },
                      );
                      setReason("");
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
      {(id && !event) || (from && !id && !template) ? null : (
        <EventForm
          key={event?.version ?? template?.id ?? "new"}
          event={event || undefined}
          template={template || undefined}
        />
      )}
      {event ? (
        <div className="panel stack-sm" style={{ marginTop: 25 }}>
          <h3>ลบอีเวนท์</h3>
          {bookings > 0 ? (
            <p className="muted">
              งานนี้มีประวัติการจอง {bookings} รายการ
              จึงลบไม่ได้เพื่อเก็บประวัติธุรกรรม ใช้ “ยกเลิกงาน” แทน
            </p>
          ) : event.status === "PUBLISHED" ? (
            <p className="muted">ปิดการขายก่อนจึงจะลบงานได้</p>
          ) : (
            <>
              <p className="muted">
                ลบงาน โซน หน่วยขาย ประเภทบัตร และผังทั้งหมดถาวร
                (ใช้เหตุผลจากช่องด้านบน)
              </p>
              <div className="actions">
                <button
                  className="button button-danger"
                  disabled={reason.trim().length < 3 || action.pending}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `ลบ “${event.title}” ถาวร? การกระทำนี้ย้อนกลับไม่ได้`,
                      )
                    )
                      return;
                    try {
                      await action.run(
                        `/api/admin/events/${event.id}`,
                        { version: event.version, reason },
                        "DELETE",
                      );
                      router.push("/admin/events");
                    } catch {}
                  }}
                >
                  <Trash2 size={16} />
                  ลบอีเวนท์
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
