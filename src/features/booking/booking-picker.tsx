"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, UserCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { api, ApiError, useResource } from "@/lib/client-api";
import type { Availability, Booking, EventData } from "@/lib/client-types";
import {
  Empty,
  ErrorNotice,
  Loading,
  money,
  PageHeading,
  modeText,
} from "@/components/ui";
import { VenueView } from "@/components/venue-view";

export function BookingPicker({ slug }: { slug: string }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const loginHref = `/login?next=${encodeURIComponent(`/events/${encodeURIComponent(slug)}/booking`)}`;
  const eventResource = useResource<EventData>(
    `/api/events?slug=${encodeURIComponent(slug)}`,
  );
  const event = eventResource.data;
  const availability = useResource<Availability>(
    event ? `/api/events/${event.id}/availability` : null,
    7000,
  );
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intent = useRef<{ payload: string; key: string } | null>(null);
  const data = availability.data;
  const tableZones = useMemo(() => {
    const filtered = (event?.zones || []).filter(
      (z) => z.sellingMode === "TABLE",
    );
    return filtered.length ? filtered : event?.zones || [];
  }, [event?.zones]);
  const activeZone = zoneId || tableZones[0]?.id;
  const units =
    data?.units.filter(
      (u) => u.zoneId === activeZone && u.sellingMode === "TABLE",
    ) || [];
  const selectedUnits =
    data?.units.filter((u) => selected.includes(u.id)) || [];
  const estimatedTotal = selectedUnits.reduce(
    (s, u) => s + u.priceSatang,
    0,
  );
  const admissions = selectedUnits.reduce(
    (s, u) => s + u.admissionCount,
    0,
  );
  function toggle(id: string) {
    setSelected((values) =>
      values.includes(id) ? values.filter((v) => v !== id) : [...values, id],
    );
  }
  async function book() {
    if (!session?.user) {
      router.push(loginHref);
      return;
    }
    if (!event) return;
    const payload = {
      eventId: event.id,
      items: selected.map((unitId) => ({ unitId, quantity: 1 })),
    };
    const canonical = JSON.stringify(payload);
    if (intent.current?.payload !== canonical)
      intent.current = { payload: canonical, key: crypto.randomUUID() };
    setPending(true);
    setError(null);
    try {
      const booking = await api<Booking>("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": intent.current.key,
        },
        body: canonical,
      });
      router.push(`/checkout/${booking.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.push(loginHref);
        return;
      }
      setError(e instanceof Error ? e : new Error("สร้างการจองไม่สำเร็จ"));
      if (e instanceof ApiError && e.code === "INVENTORY_UNAVAILABLE") {
        await availability.reload();
        setSelected([]);
        intent.current = null;
      }
    } finally {
      setPending(false);
    }
  }
  if (eventResource.loading) return <Loading />;
  if (eventResource.error)
    return (
      <div className="mongkol-page customer-page">
        <div className="mongkol-container section">
          <ErrorNotice
            error={eventResource.error}
            retry={eventResource.reload}
          />
        </div>
      </div>
    );
  if (!event) return null;
  return (
    <div className="mongkol-page customer-page event-detail-page">
      <div className="event-detail-backdrop" aria-hidden="true">
        <Image
          src={event.posterUrl || "/concert-hero.png"}
          alt=""
          fill
          sizes="100vw"
          unoptimized={!!event.posterUrl?.startsWith("https:")}
        />
      </div>
      <div className="mongkol-container section event-detail-content">
        <Link
          href={`/events/${slug}`}
          className="view-all-button customer-back-link"
        >
          <ArrowLeft size={17} />
          <span>กลับไปดูรายละเอียดอีเวนต์</span>
        </Link>
        <div style={{ marginTop: 26 }}>
          <div className="section-kicker" style={{ marginBottom: 8 }}>
            <span /> INTERACTIVE FLOOR PLAN
          </div>
          <PageHeading
            title="เลือกโต๊ะและที่นั่งของคุณ"
            description={event.title}
          />
        </div>
        <div className="booking-workspace">
          <div className="stack">
            <div className="notice">
              การเลือกในหน้านี้ยังไม่พักสิทธิ์
              ที่นั่งจะถูกกันไว้เมื่อสร้างการจองสำเร็จเท่านั้น
            </div>
            <div className="customer-card">
              <div className="between floorplan-card-head">
                <div>
                  <h3 className="floorplan-section-title">เลือกโต๊ะของคุณ</h3>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    คลิกเลือกโต๊ะว่างสีเขียวจากผังด้านล่าง
                  </p>
                </div>
                <button
                  type="button"
                  className="floorplan-refresh-pill"
                  onClick={availability.reload}
                >
                  <RefreshCw size={14} />
                  <span>อัปเดตผัง</span>
                </button>
              </div>
              <div className="floorplan-legend" aria-label="สัญลักษณ์สถานะการจองโต๊ะ">
                <span className="floorplan-legend-item">
                  <i className="floorplan-swatch is-available" aria-hidden="true" />
                  <span>ว่าง</span>
                </span>
                <span className="floorplan-legend-item">
                  <i className="floorplan-swatch is-sold" aria-hidden="true" />
                  <span>จองแล้ว</span>
                </span>
                <span className="floorplan-legend-item">
                  <i className="floorplan-swatch is-selected" aria-hidden="true" />
                  <span>เลือกแล้ว</span>
                </span>
                {units.length > 0 ? (
                  <span
                    className="muted"
                    style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600 }}
                  >
                    โต๊ะว่าง{" "}
                    {
                      units.filter(
                        (u) =>
                          (u.status || u.inventory?.status) === "AVAILABLE",
                      ).length
                    }{" "}
                    / {units.length} โต๊ะ
                  </span>
                ) : null}
              </div>
              {tableZones.length > 1 ? (
                <div className="tabs" role="tablist" aria-label="โซนโต๊ะ">
                  {tableZones.map((zone) => (
                    <button
                      key={zone.id}
                      role="tab"
                      aria-selected={activeZone === zone.id}
                      onClick={() => setZoneId(zone.id)}
                    >
                      {zone.name} · {modeText(zone.sellingMode)}
                    </button>
                  ))}
                </div>
              ) : null}
              <ErrorNotice
                error={availability.error}
                retry={availability.reload}
              />
              {availability.loading && !data?.layout ? (
                <Loading />
              ) : data?.layout ? (
                <VenueView
                  layout={data.layout}
                  units={data.units.filter((u) => u.sellingMode === "TABLE")}
                  selected={selected}
                  onSelect={toggle}
                  tablesOnly
                />
              ) : (
                <Empty title="โซนนี้ยังไม่มีผังโต๊ะเปิดขาย" />
              )}
            </div>
          </div>
          <aside className="panel sticky-panel customer-sticky-card">
            <div className="section-kicker" style={{ marginBottom: 8 }}>
              <span /> BOOKING SUMMARY
            </div>
            <h2>การจองของคุณ</h2>
            <div className="guest-mode-banner">
              <UserCheck size={18} />
              <div>
                <strong>
                  จองในนามสมาชิก: {session?.user.name ?? "กำลังตรวจสอบบัญชี"}
                </strong>
                <small>
                  บันทึกประวัติการจองและดูบัตรย้อนหลังได้ในเมนู{" "}
                  <Link href="/account/bookings" className="text-link">
                    การจองของฉัน
                  </Link>
                </small>
              </div>
            </div>
            {selectedUnits.length ? (
              <ul className="summary-list">
                {selectedUnits.map((u) => (
                  <li key={u.id}>
                    <span>
                      {u.name || u.code}
                      <small>
                        1 โต๊ะ · {u.admissionCount} ที่นั่ง
                      </small>
                    </span>
                    <strong>{money(u.priceSatang)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>
                คลิกเลือกโต๊ะว่างจากผังด้านซ้าย
              </p>
            )}
            <div className="summary-row">
              <span className="muted">จำนวนสิทธิ์เข้า</span>
              <strong>{admissions} คน</strong>
            </div>
            <div className="summary-row summary-total">
              <div>
                <span className="muted">ยอดประมาณจากราคาปัจจุบัน</span>
                <br />
                <small className="muted">ยอดยืนยันแสดงในขั้นตอนถัดไป</small>
              </div>
              <strong>{money(estimatedTotal)}</strong>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                รับทราบเงื่อนไขการจอง และจะทดสอบชำระเงินผ่าน QR ภายใน 5 นาที
                (เดโม ไม่มีการรับเงินจริง)
              </span>
            </label>
            <ErrorNotice error={error} />
            <button
              className="mongkol-button button-wide"
              style={{ marginTop: 16 }}
              disabled={
                !accepted || admissions === 0 || pending || sessionPending
              }
              onClick={book}
            >
              {pending ? "กำลังสร้างการจอง" : "ยืนยันและไปชำระเงิน"}
              <ArrowRight size={17} />
            </button>
            {error && !(error instanceof ApiError) ? (
              <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
                การเชื่อมต่ออาจขัดข้อง
                กดอีกครั้งด้วยรายการเดิมเพื่อตรวจผลเดิมอย่างปลอดภัย
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
