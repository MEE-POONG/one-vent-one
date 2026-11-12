"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { api, ApiError, useResource } from "@/lib/client-api";
import type { Availability, Booking, EventData } from "@/lib/client-types";
import {
  Empty,
  ErrorNotice,
  Loading,
  money,
  PageHeading,
  Status,
  modeText,
} from "@/components/ui";
import { VenueView } from "@/components/venue-view";

export function BookingPicker({ slug }: { slug: string }) {
  const router = useRouter();
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
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intent = useRef<{ payload: string; key: string } | null>(null);
  const data = availability.data;
  const activeZone = zoneId || event?.zones?.[0]?.id;
  const units = data?.units.filter((u) => u.zoneId === activeZone) || [];
  const ticketTypes =
    data?.ticketTypes.filter((t) => t.zoneId === activeZone) || [];
  const selectedUnits =
    data?.units.filter((u) => selected.includes(u.id)) || [];
  const selectedTypes =
    data?.ticketTypes.filter((t) => (quantities[t.id] || 0) > 0) || [];
  const estimatedTotal =
    selectedUnits.reduce((s, u) => s + u.priceSatang, 0) +
    selectedTypes.reduce((s, t) => s + t.priceSatang * quantities[t.id], 0);
  const admissions =
    selectedUnits.reduce((s, u) => s + u.admissionCount, 0) +
    selectedTypes.reduce((s, t) => s + quantities[t.id], 0);
  function toggle(id: string) {
    setSelected((values) =>
      values.includes(id) ? values.filter((v) => v !== id) : [...values, id],
    );
  }
  async function book() {
    if (!event) return;
    const payload = {
      eventId: event.id,
      items: [
        ...selected.map((unitId) => ({ unitId, quantity: 1 })),
        ...selectedTypes.map((t) => ({
          ticketTypeId: t.id,
          quantity: quantities[t.id],
        })),
      ],
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
      setError(e instanceof Error ? e : new Error("สร้างการจองไม่สำเร็จ"));
      if (e instanceof ApiError && e.code === "INVENTORY_UNAVAILABLE") {
        await availability.reload();
        setSelected([]);
        setQuantities({});
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
          <ErrorNotice error={eventResource.error} retry={eventResource.reload} />
        </div>
      </div>
    );
  if (!event) return null;
  return (
    <div className="mongkol-page customer-page">
      <div className="mongkol-container section">
        <Link href={`/events/${slug}`} className="view-all-button customer-back-link">
          <ArrowLeft size={17} />
          <span>กลับไปดูรายละเอียดอีเวนต์</span>
        </Link>
        <div style={{ marginTop: 26 }}>
          <div className="section-kicker" style={{ marginBottom: 8 }}>
            <span /> INTERACTIVE FLOOR PLAN
          </div>
          <PageHeading title="เลือกโต๊ะและที่นั่งของคุณ" description={event.title} />
        </div>
        <div className="booking-workspace">
          <div className="stack">
            <div className="notice">
              การเลือกในหน้านี้ยังไม่พักสิทธิ์
              ที่นั่งจะถูกกันไว้เมื่อสร้างการจองสำเร็จเท่านั้น
            </div>
            <div className="customer-card">
              <div className="tabs" role="tablist" aria-label="โซน">
                {event.zones?.map((zone) => (
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
              {data?.layout ? (
                <VenueView
                  layout={data.layout}
                  units={data.units}
                  selected={selected}
                  onSelect={toggle}
                />
              ) : null}
              <div className="legend">
                {["AVAILABLE", "HELD", "REVIEW_RESERVED", "SOLD", "BLOCKED"].map(
                  (status) => (
                    <Status key={status} value={status} />
                  ),
                )}
              </div>
              <ErrorNotice
                error={availability.error}
                retry={availability.reload}
              />
              {availability.loading ? (
                <Loading />
              ) : (
                <>
                  <div className="between" style={{ margin: "24px 0 17px" }}>
                    <h3>เลือกจากรายการ</h3>
                    <button className="text-link" onClick={availability.reload}>
                      <RefreshCw size={13} />
                      อัปเดตที่ว่าง
                    </button>
                  </div>
                  <div className="unit-grid">
                    {units.map((unit) => {
                      const status =
                        unit.status || unit.inventory?.status || "BLOCKED";
                      return (
                        <button
                          key={unit.id}
                          className={`unit-choice ${selected.includes(unit.id) ? "selected" : ""}`}
                          aria-pressed={selected.includes(unit.id)}
                          disabled={status !== "AVAILABLE"}
                          onClick={() => toggle(unit.id)}
                        >
                          <strong>{unit.code}</strong>
                          <span>{money(unit.priceSatang)}</span>
                          <small>{unit.admissionCount} สิทธิ์เข้า</small>
                          <Status value={status} />
                        </button>
                      );
                    })}
                  </div>
                  {ticketTypes.map((type) => {
                    const pool = data?.pools.find((p) => p.id === type.poolId);
                    return (
                      <div className="ga-choice" key={type.id}>
                        <div>
                          <h3>{type.name}</h3>
                          <p>
                            {money(type.priceSatang)} / คน · คงเหลือร่วม{" "}
                            {pool?.available ?? 0} สิทธิ์
                          </p>
                        </div>
                        <label className="field">
                          <span className="sr-only">จำนวน {type.name}</span>
                          <select
                            value={quantities[type.id] || 0}
                            onChange={(e) =>
                              setQuantities((q) => ({
                                ...q,
                                [type.id]: Number(e.target.value),
                              }))
                            }
                          >
                            {Array.from(
                              { length: Math.min(20, pool?.available || 0) + 1 },
                              (_, i) => (
                                <option key={i} value={i}>
                                  {i}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      </div>
                    );
                  })}
                  {units.length === 0 && ticketTypes.length === 0 ? (
                    <Empty title="โซนนี้ยังไม่มีหน่วยเปิดขาย" />
                  ) : null}
                </>
              )}
            </div>
          </div>
          <aside className="panel sticky-panel customer-sticky-card">
            <div className="section-kicker" style={{ marginBottom: 8 }}>
              <span /> BOOKING SUMMARY
            </div>
            <h2>การจองของคุณ</h2>
            {selectedUnits.length || selectedTypes.length ? (
              <ul className="summary-list">
                {selectedUnits.map((u) => (
                  <li key={u.id}>
                    <span>
                      {u.name || u.code}
                      <small>
                        1 {modeText(u.sellingMode)} · {u.admissionCount} คน
                      </small>
                    </span>
                    <strong>{money(u.priceSatang)}</strong>
                  </li>
                ))}
                {selectedTypes.map((t) => (
                  <li key={t.id}>
                    <span>
                      {t.name}
                      <small>{quantities[t.id]} ใบ</small>
                    </span>
                    <strong>{money(t.priceSatang * quantities[t.id])}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>
                เลือกโต๊ะ ที่นั่ง หรือบัตรจากรายการ
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
                รับทราบเงื่อนไขการจอง และจะทดสอบชำระเงินผ่าน QR ภายใน 5 นาที (เดโม ไม่มีการรับเงินจริง)
              </span>
            </label>
            <ErrorNotice error={error} />
            <button
              className="mongkol-button button-wide"
              style={{ marginTop: 16 }}
              disabled={!accepted || admissions === 0 || pending}
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
