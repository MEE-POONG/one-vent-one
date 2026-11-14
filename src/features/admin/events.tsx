"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Map,
  Copy,
  Trash2,
  Wand2,
  CheckCircle2,
} from "lucide-react";
import { useMutation, useResource } from "@/lib/client-api";
import type {
  EventData,
  LayoutObject,
  PageData,
  Unit,
} from "@/lib/client-types";
import { ImageField } from "./image-field";
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
import {
  alignGroupToCanvasCenter,
  computeTableGridPositions,
  formatTableCode,
  generateTableBatchSpecs,
  snap10,
} from "./table-grid-helpers";
import { WordGridPicker } from "./word-grid-picker";

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
                      <small>
                        {event.venue}
                        {event.showInSlider ? " · แสดงบน Slide Show หน้าแรก" : ""}
                      </small>
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
                          href={`/admin/events/${event.id}/inventory`}
                        >
                          โต๊ะ/ราคา
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
                          title="สร้างงานใหม่โดยคัดลอกชุดโต๊ะ ราคา และผัง"
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

function buildDefaultDates() {
  const now = new Date();
  const showStart = new Date(now.getTime() + 7 * 24 * 3600000);
  showStart.setUTCHours(13, 0, 0, 0); // 20:00 Thai time
  const showEnd = new Date(showStart.getTime() + 4 * 3600000 - 60000); // 23:59 Thai time
  const saleStart = new Date(now.getTime());
  saleStart.setUTCSeconds(0, 0);
  return {
    startsAt: dateInput(showStart.toISOString()),
    endsAt: dateInput(showEnd.toISOString()),
    saleStartsAt: dateInput(saleStart.toISOString()),
    saleEndsAt: dateInput(showEnd.toISOString()),
  };
}

function makeAutoSlug(title: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  if (ascii.length >= 3) return ascii;
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `event-${stamp}-${suffix}`;
}

/**
 * `event` = edit an existing event. `template` = create a new draft that copies the
 * template's zones, units, prices and layout. Neither = blank new event.
 */
function EventForm({
  event,
  template,
  onSaved,
}: {
  event?: EventData;
  template?: EventData;
  onSaved?: () => Promise<void>;
}) {
  const router = useRouter();
  const mutation = useMutation();
  const [imagePending, setImagePending] = useState(false);
  const isBlankNew = !event && !template;

  const initial: Partial<EventData> | undefined =
    event ??
    (template && {
      ...template,
      title: `${template.title} (รอบใหม่)`.slice(0, 160),
      slug: `${template.slug}-2`.slice(0, 100),
    });

  const defaultDates = useMemo(() => buildDefaultDates(), []);
  const [titleVal, setTitleVal] = useState(initial?.title || "");
  const [slugVal, setSlugVal] = useState(initial?.slug || "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [venueVal, setVenueVal] = useState(initial?.venue || "มงคลบาร์");

  const [startsAtVal, setStartsAtVal] = useState(
    initial?.startsAt ? dateInput(initial.startsAt) : defaultDates.startsAt,
  );
  const [endsAtVal, setEndsAtVal] = useState(
    initial?.endsAt ? dateInput(initial.endsAt) : defaultDates.endsAt,
  );
  const [saleStartsAtVal, setSaleStartsAtVal] = useState(
    initial?.saleStartsAt
      ? dateInput(initial.saleStartsAt)
      : defaultDates.saleStartsAt,
  );
  const [saleEndsAtVal, setSaleEndsAtVal] = useState(
    initial?.saleEndsAt
      ? dateInput(initial.saleEndsAt)
      : defaultDates.saleEndsAt,
  );

  // Quick Initial Floor Plan & Table Grid Setup (for new events)
  const [quickSetupTables, setQuickSetupTables] = useState(isBlankNew);
  const [gridRows, setGridRows] = useState(4);
  const [gridCols, setGridCols] = useState(6);
  const [gridPrefix, setGridPrefix] = useState("T");
  const [gridSeats, setGridSeats] = useState("4");
  const [gridPrice, setGridPrice] = useState("2400");

  const previewSpecs = useMemo(
    () =>
      generateTableBatchSpecs({
        prefix: gridPrefix,
        startNumber: 1,
        count: gridRows * gridCols,
        seats: Number(gridSeats) || 4,
        priceBaht: Number(gridPrice) || 2400,
      }),
    [gridPrefix, gridRows, gridCols, gridSeats, gridPrice],
  );

  return (
    <form
      className="panel stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (imagePending || mutation.pending) return;
        const form = new FormData(e.currentTarget);
        const finalSlug = slugVal.trim() || makeAutoSlug(titleVal);
        const payload = {
          title: titleVal.trim(),
          slug: finalSlug,
          description: String(form.get("description")),
          artists: String(form.get("artists"))
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          venue: venueVal.trim(),
          posterUrl: String(form.get("posterUrl")),
          startsAt: new Date(`${startsAtVal}+07:00`).toISOString(),
          endsAt: new Date(`${endsAtVal}+07:00`).toISOString(),
          saleStartsAt: new Date(`${saleStartsAtVal}+07:00`).toISOString(),
          saleEndsAt: new Date(`${saleEndsAtVal}+07:00`).toISOString(),
          showInSlider: form.get("showInSlider") === "on",
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

          // If creating a blank new event and quick table setup is enabled:
          // atomically create tables, place Stage + Entrance + Table Grid, center them as a group, and publish layout!
          if (isBlankNew && quickSetupTables && previewSpecs.length > 0) {
            try {
              const batchRes = await mutation.run<{
                units: Unit[];
                eventVersion: number;
              }>(
                `/api/admin/events/${result.id}/units/batch`,
                {
                  sellingMode: "TABLE",
                  units: previewSpecs,
                },
                "POST",
              );

              const baseStage: LayoutObject = {
                id: crypto.randomUUID(),
                code: "STAGE",
                name: "STAGE",
                type: "stage",
                shape: "rect",
                x: 290,
                y: 30,
                width: 420,
                height: 70,
                rotation: 0,
              };
              const placement = computeTableGridPositions({
                totalCount: batchRes.units.length,
                cols: gridCols,
                canvasWidth: 1000,
                canvasHeight: 700,
                existingObjects: [baseStage],
                replaceExistingTables: true,
              });
              baseStage.x = snap10((placement.requiredWidth - 420) / 2);

              const entranceObj: LayoutObject = {
                id: crypto.randomUUID(),
                code: "ENTRANCE",
                name: "ทางเข้า (Entrance)",
                type: "entrance",
                shape: "rect",
                x: snap10((placement.requiredWidth - 150) / 2),
                y: snap10(placement.requiredHeight - 70),
                width: 150,
                height: 50,
                rotation: 0,
              };

              const tableObjs: LayoutObject[] = batchRes.units.map((u, idx) => {
                const pos = placement.positions[idx];
                return {
                  id: crypto.randomUUID(),
                  code: u.code,
                  name: u.name,
                  type: "table",
                  shape: "rect",
                  x: pos.x,
                  y: pos.y,
                  width: pos.width,
                  height: pos.height,
                  rotation: 0,
                  zoneId: u.zoneId,
                  unitId: u.id,
                };
              });

              const centeredObjects = alignGroupToCanvasCenter({
                objects: [baseStage, ...tableObjs, entranceObj],
                canvasWidth: placement.requiredWidth,
                canvasHeight: placement.requiredHeight,
                gridStep: 10,
              });

              const savedLayout = await mutation.run<{ version: number }>(
                `/api/admin/events/${result.id}/layout`,
                {
                  version: 0,
                  width: placement.requiredWidth,
                  height: placement.requiredHeight,
                  geometry: {
                    objects: centeredObjects,
                  },
                },
                "PUT",
              );

              await mutation.run(
                `/api/admin/events/${result.id}/layout/publish`,
                { version: savedLayout.version ?? 1 },
                "POST",
              );
            } catch {
              // Event itself is already created; redirect to event page where admin can continue
            }
          }

          if (event) await onSaved?.();
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
        <Field label="ชื่ออีเวนท์">
          <input
            name="title"
            required
            value={titleVal}
            maxLength={160}
            placeholder="เช่น MONGKOL ACOUSTIC NIGHT"
            onChange={(e) => {
              const nextTitle = e.target.value;
              setTitleVal(nextTitle);
              if (!slugTouched) {
                setSlugVal(makeAutoSlug(nextTitle));
              }
            }}
          />
        </Field>
        <Field
          label="ชื่อในลิงก์ (ภาษาอังกฤษ - สร้างให้อัตโนมัติได้)"
          hint="a-z, 0-9 และ - เท่านั้น ต้องไม่ซ้ำกับงานอื่น"
        >
          <div style={{ display: "flex", gap: 8 }}>
            <input
              name="slug"
              required
              value={slugVal}
              maxLength={100}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="mongkol-acoustic-night"
              onChange={(e) => {
                setSlugTouched(true);
                setSlugVal(e.target.value);
              }}
            />
            <button
              type="button"
              className="button button-subtle button-small"
              onClick={() => {
                setSlugVal(makeAutoSlug(titleVal));
                setSlugTouched(false);
              }}
              title="สร้างชื่อลิงก์อัตโนมัติจากชื่ออีเวนท์"
            >
              <Wand2 size={14} />
              อัตโนมัติ
            </button>
          </div>
        </Field>
        <Field label="สถานที่">
          <input
            name="venue"
            required
            value={venueVal}
            maxLength={500}
            onChange={(e) => setVenueVal(e.target.value)}
          />
        </Field>
        <Field label="ศิลปิน (คั่นด้วยเครื่องหมายจุลภาค)">
          <input
            name="artists"
            defaultValue={initial?.artists?.join(", ") || ""}
            placeholder="เช่น Nalin Trio, DJ Kavin"
          />
        </Field>
        <div className="full">
          <ImageField
            name="posterUrl"
            label="ภาพโปสเตอร์อีเวนท์"
            kind="poster"
            initialValue={initial?.posterUrl || ""}
            disabled={mutation.pending}
            onPendingChange={setImagePending}
          />
        </div>
        <div className="full">
          <Field label="รายละเอียดงาน">
            <textarea
              name="description"
              defaultValue={initial?.description || ""}
              maxLength={10000}
              placeholder="รายละเอียดบรรยากาศงาน เงื่อนไขโต๊ะ และการเข้างาน..."
            />
          </Field>
        </div>
        <Field label="เริ่มแสดง (เวลาไทย)">
          <input
            name="startsAt"
            type="datetime-local"
            required
            value={startsAtVal}
            onChange={(e) => setStartsAtVal(e.target.value)}
          />
        </Field>
        <Field label="สิ้นสุดการแสดง (เวลาไทย)">
          <input
            name="endsAt"
            type="datetime-local"
            required
            value={endsAtVal}
            onChange={(e) => {
              setEndsAtVal(e.target.value);
              if (saleEndsAtVal > e.target.value) {
                setSaleEndsAtVal(e.target.value);
              }
            }}
          />
        </Field>
        <Field label="เริ่มขาย (เวลาไทย)">
          <input
            name="saleStartsAt"
            type="datetime-local"
            required
            value={saleStartsAtVal}
            onChange={(e) => setSaleStartsAtVal(e.target.value)}
          />
        </Field>
        <Field
          label="สิ้นสุดการขาย (เวลาไทย)"
          hint="ต้องไม่เกินเวลาสิ้นสุดการแสดง"
        >
          <div style={{ display: "flex", gap: 8 }}>
            <input
              name="saleEndsAt"
              type="datetime-local"
              required
              value={saleEndsAtVal}
              onChange={(e) => setSaleEndsAtVal(e.target.value)}
            />
            <button
              type="button"
              className="button button-subtle button-small"
              onClick={() => setSaleEndsAtVal(endsAtVal)}
              title="ตั้งให้ตรงกับเวลาสิ้นสุดการแสดง"
            >
              ตรงเวลาจบงาน
            </button>
          </div>
        </Field>
        <div className="full">
          <label className="check-label" style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              name="showInSlider"
              defaultChecked={initial?.showInSlider ?? true}
            />
            <span>นำอีเวนท์นี้ขึ้นแสดงบน Slide Show หน้าแรก (Homepage)</span>
          </label>
        </div>
      </div>

      {isBlankNew ? (
        <div className="editor-popover-panel" style={{ marginTop: 10 }}>
          <label className="check-label" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={quickSetupTables}
              onChange={(e) => setQuickSetupTables(e.target.checked)}
            />
            <span>
              <strong>
                สร้างตารางโต๊ะเริ่มต้น (Auto-Increment) พร้อมจัดผังอัตโนมัติในขั้นตอนเดียว
              </strong>{" "}
              (ราคาขายยึดตามชุดโต๊ะที่สร้าง สามารถเพิ่มชุดโต๊ะราคาอื่นหรือปรับแต่งผังภายหลังได้)
            </span>
          </label>

          {quickSetupTables ? (
            <div className="editor-grid-builder-layout" style={{ marginTop: 18 }}>
              <div className="stack-sm">
                <div className="form-grid">
                  <Field label="คำนำหน้ารหัสโต๊ะ (Prefix)">
                    <input
                      value={gridPrefix}
                      onChange={(e) => setGridPrefix(e.target.value)}
                      placeholder="T"
                    />
                  </Field>
                  <Field label="รหัสโต๊ะที่จะสร้างอัตโนมัติ">
                    <input
                      readOnly
                      value={
                        previewSpecs.length
                          ? `${previewSpecs[0].code} – ${previewSpecs[previewSpecs.length - 1].code} (${previewSpecs.length} โต๊ะ)`
                          : "-"
                      }
                    />
                  </Field>
                  <Field label="จำนวนที่นั่งต่อโต๊ะ (คน)">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={gridSeats}
                      onChange={(e) => setGridSeats(e.target.value)}
                    />
                  </Field>
                  <Field label="ราคาขายชุดโต๊ะนี้ (บาท/โต๊ะ)">
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      value={gridPrice}
                      onChange={(e) => setGridPrice(e.target.value)}
                    />
                  </Field>
                </div>
                <p className="muted" style={{ fontSize: 12 }}>
                  ระบบจะสร้างชุดโต๊ะ{" "}
                  <strong>
                    {formatTableCode(gridPrefix, 1)} ถึง{" "}
                    {formatTableCode(gridPrefix, gridRows * gridCols)}
                  </strong>{" "}
                  พร้อมวางเวที ทางเข้า และจัดเรียงโต๊ะเป็นตาราง {gridRows} แถว ×{" "}
                  {gridCols} โต๊ะ/แถว ให้อยู่กึ่งกลางผังอัตโนมัติทันทีที่กดบันทึก
                </p>
              </div>

              <WordGridPicker
                rows={gridRows}
                cols={gridCols}
                codePreview={
                  previewSpecs.length
                    ? `${previewSpecs[0].code} – ${previewSpecs[previewSpecs.length - 1].code} (${gridSeats || 4} ที่ · ฿${Number(gridPrice || 0).toLocaleString("th-TH")})`
                    : undefined
                }
                onSelect={(r, c) => {
                  setGridRows(r);
                  setGridCols(c);
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <ErrorNotice error={mutation.error} />
      <div className="actions">
        <button
          type="submit"
          className="button"
          disabled={mutation.pending || imagePending}
        >
          {mutation.pending
            ? "กำลังบันทึก..."
            : template
              ? "สร้างงานจากต้นฉบับ"
              : isBlankNew && quickSetupTables
                ? `บันทึกอีเวนท์และสร้างตารางโต๊ะ (${gridRows * gridCols} โต๊ะ)`
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
  const hasUnits =
    (event.units?.some((u) => u.active) ?? false) ||
    (event.ticketTypes?.some((t) => t.active) ?? false);
  const hasPublishedLayout = Boolean(event.publishedLayoutVersion);
  const saleOpenTimeOk =
    Date.parse(event.saleEndsAt) > Date.parse(event.serverNow ?? "");

  const checks = [
    {
      ok: hasUnits,
      label: `มีชุดโต๊ะที่เปิดขาย (${event.units?.filter((u) => u.active).length ?? 0} โต๊ะ)`,
      href: `/admin/events/${event.id}/layout`,
      cta: "ไปเพิ่มตารางโต๊ะ",
    },
    {
      ok: hasPublishedLayout,
      label: "เผยแพร่ผังแล้ว (ถ้าแก้ผังหรือเพิ่มโต๊ะใหม่ ต้องกดเผยแพร่ผังอีกครั้ง)",
      href: `/admin/events/${event.id}/layout`,
      cta: "ไปจัดผังและเผยแพร่",
    },
    {
      ok: saleOpenTimeOk,
      label: "ช่วงขายยังไม่สิ้นสุด",
    },
  ];
  return (
    <ul className="stack-sm" style={{ listStyle: "none", padding: 0 }}>
      {checks.map((c) => (
        <li
          key={c.label}
          className={c.ok ? "" : "muted"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span>
            {c.ok ? "✓" : "✗"} {c.label}
          </span>
          {!c.ok && c.href ? (
            <Link
              href={c.href}
              className="button button-outline button-small"
              style={{ padding: "4px 10px", fontSize: 11 }}
            >
              {c.cta}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

const DEFAULT_REASONS: Record<string, string> = {
  publish: "เปิดขายอีเวนท์ตามกำหนดการ",
  close: "ปิดการขายชั่วคราวโดยผู้ดูแลระบบ",
  draft: "กลับเป็นฉบับร่างเพื่อปรับโครงสร้างโซนและโต๊ะ",
  complete: "สิ้นสุดการแสดงตามกำหนดการ",
  cancel: "ยกเลิกการจัดงานโดยผู้ดูแลระบบ",
};

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

  async function cancelEvent(current: EventData, cancelReason: string) {
    // The server cancels 25 bookings per call; keep calling until none remain.
    setProgress("");
    try {
      for (let round = 0; round < 400; round++) {
        const result = await action.run<CancelResult>(
          `/api/admin/events/${current.id}/cancel`,
          { version: current.version, reason: cancelReason },
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
          label: "เปิดขายทันที",
          show: ["DRAFT", "CLOSED"].includes(event.status),
        },
        {
          name: "close",
          label: "ปิดการขาย",
          show: event.status === "PUBLISHED",
        },
        {
          name: "draft",
          label: "กลับเป็นฉบับร่าง (เพื่อเพิ่ม/ลบโต๊ะ)",
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
            <Link href={`/admin/events/${id}/inventory`}>
              จัดการโต๊ะและราคา ({event.units?.length ?? 0} โต๊ะ)
            </Link>
            <Link href={`/admin/events/${id}/layout`}>
              แก้ไขผัง ({event.publishedLayoutVersion ? "เผยแพร่แล้ว" : "ร่าง"})
            </Link>
            <Link href={`/events/${event.slug}`}>หน้าลูกค้า</Link>
            <Link href={`/admin/events/new?from=${id}`}>ทำซ้ำเป็นรอบใหม่</Link>
          </div>
          <div className="panel stack-sm" style={{ marginBottom: 25 }}>
            <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
              <h3 style={{ margin: 0 }}>สถานะการขายและความพร้อม</h3>
              <Status value={event.status} />
            </div>
            <p className="muted">
              การจองทั้งหมด {bookings} รายการ (ใช้งานอยู่ {activeBookings}) · โต๊ะทั้งหมด{" "}
              {event.units?.length ?? 0} โต๊ะ
            </p>
            {["DRAFT", "CLOSED"].includes(event.status) ? (
              <>
                <strong>รายการตรวจสอบก่อนเปิดขาย</strong>
                <Readiness event={event} />
              </>
            ) : null}
            {event.status === "PUBLISHED" ? (
              <p className="muted">
                ต้องการเพิ่มหรือลบจำนวนโต๊ะ: กด “ปิดการขาย” แล้วกด
                “กลับเป็นฉบับร่าง” (ทำได้เมื่อไม่มีการจองที่ใช้งานอยู่)
              </p>
            ) : null}
            <Field label="หมายเหตุ / เหตุผลการเปลี่ยนสถานะ (เว้นว่างไว้เพื่อใช้ค่าเริ่มต้นอัตโนมัติได้)">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น เปิดขายตามกำหนดการ (จำเป็นต้องระบุเฉพาะกรณียกเลิกงานหรือลบงาน)"
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
                  className={`button ${
                    a.name === "publish"
                      ? ""
                      : a.name === "cancel"
                        ? "button-danger"
                        : "button-outline"
                  }`}
                  disabled={
                    action.pending ||
                    (a.name === "cancel" && reason.trim().length < 3)
                  }
                  onClick={async () => {
                    const effectiveReason =
                      reason.trim().length >= 3
                        ? reason.trim()
                        : DEFAULT_REASONS[a.name] || "ดำเนินการโดยผู้ดูแลระบบ";
                    if (a.name === "cancel") {
                      if (
                        event.status !== "CANCELLED" &&
                        !window.confirm(
                          "ยกเลิกอีเวนท์นี้และรายการจองทั้งหมด? เงินที่รับแล้วจะเข้าคิวคืนเงิน",
                        )
                      )
                        return;
                      await cancelEvent(event, effectiveReason);
                      return;
                    }
                    try {
                      await action.run(
                        `/api/admin/events/${event.id}/${a.name}`,
                        { version: event.version, reason: effectiveReason },
                      );
                      setReason("");
                      await resource.reload();
                    } catch {}
                  }}
                >
                  {a.name === "publish" ? <CheckCircle2 size={15} /> : null}
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
          onSaved={id ? resource.reload : undefined}
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
              </p>
              <div className="actions">
                <button
                  className="button button-danger"
                  disabled={action.pending}
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
                        {
                          version: event.version,
                          reason:
                            reason.trim().length >= 3
                              ? reason.trim()
                              : "ลบอีเวนท์ฉบับร่างโดยผู้ดูแลระบบ",
                        },
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
