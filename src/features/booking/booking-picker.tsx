"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Ticket as TicketIcon,
  UserCheck,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { api, ApiError, useResource } from "@/lib/client-api";
import type {
  Availability,
  Booking,
  BookingItem,
  EventData,
} from "@/lib/client-types";
import {
  dateTime,
  Empty,
  ErrorNotice,
  Loading,
  money,
  PageHeading,
  Status,
} from "@/components/ui";
import { VenueView } from "@/components/venue-view";

function formatBookingItemLabel(item: BookingItem) {
  const snap = item.snapshot || {};
  if (item.sellingMode === "TABLE") {
    const label = String(snap.unitName || snap.unitCode || "โต๊ะ");
    return `${label} (${item.admissionCount} ที่นั่ง)`;
  }
  if (item.sellingMode === "SEAT") {
    return String(snap.unitName || snap.unitCode || "ที่นั่ง");
  }
  const zoneOrTicket = String(
    snap.ticketTypeName || snap.zoneName || snap.unitName || "บัตรเข้างาน",
  );
  return `${zoneOrTicket} × ${item.quantity} ใบ`;
}

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
  const myBookingsResource = useResource<{
    bookings: Booking[];
    total: number;
  }>(
    event && session?.user
      ? `/api/me/bookings?eventId=${encodeURIComponent(event.id)}&pageSize=20`
      : null,
    10000,
  );
  const myEventBookings = myBookingsResource.data?.bookings ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intent = useRef<{ payload: string; key: string } | null>(null);
  const data = availability.data;
  const units = data?.units || [];
  const ticketTypes = data?.ticketTypes ?? [];
  const selectedTypes = ticketTypes.filter((t) => (quantities[t.id] || 0) > 0);
  const selectedUnits =
    data?.units.filter((u) => selected.includes(u.id)) || [];
  const estimatedTotal =
    selectedUnits.reduce((s, u) => s + u.priceSatang, 0) +
    selectedTypes.reduce((sum, t) => sum + t.priceSatang * quantities[t.id], 0);
  const admissions =
    selectedUnits.reduce((s, u) => s + u.admissionCount, 0) +
    selectedTypes.reduce((sum, t) => sum + quantities[t.id], 0);
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
      if (e instanceof ApiError && e.status === 401) {
        router.push(loginHref);
        return;
      }
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
            title="เลือกโต๊ะหรือโซนบัตรเข้างาน"
            description={event.title}
          />
        </div>
        <div className="booking-workspace">
          <div className="stack">
            <div className="notice">
              การเลือกในหน้านี้ยังไม่พักสิทธิ์
              สิทธิ์จะถูกล็อกไว้ให้ 5 นาทีเมื่อกดยืนยันสร้างการจอง
            </div>
            <div className="customer-card">
              <div className="between floorplan-card-head">
                <div>
                  <h3 className="floorplan-section-title">เลือกโต๊ะหรือโซนจากผัง</h3>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    คลิกเลือกโต๊ะหรือโซนที่ต้องการจากผังด้านล่างได้โดยตรง
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
              <div
                className="floorplan-legend"
                aria-label="สัญลักษณ์สถานะการจอง"
              >
                <span className="floorplan-legend-item">
                  <i
                    className="floorplan-swatch is-available"
                    aria-hidden="true"
                  />
                  <span>ว่าง</span>
                </span>
                <span className="floorplan-legend-item">
                  <i className="floorplan-swatch is-sold" aria-hidden="true" />
                  <span>เต็ม / จองแล้ว</span>
                </span>
                <span className="floorplan-legend-item">
                  <i
                    className="floorplan-swatch is-selected"
                    aria-hidden="true"
                  />
                  <span>เลือกแล้ว</span>
                </span>
                {units.length > 0 ? (
                  <span
                    className="muted"
                    style={{
                      marginLeft: "auto",
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
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
              <ErrorNotice
                error={availability.error}
                retry={availability.reload}
              />
              {availability.loading && !data?.layout ? (
                <Loading />
              ) : data?.layout ? (
                <VenueView
                  layout={data.layout}
                  units={units}
                  selected={selected}
                  onSelect={toggle}
                  zones={data.zones || event.zones || []}
                  ticketTypes={ticketTypes}
                  pools={data.pools || []}
                  selectedQuantities={quantities}
                  onChangeZoneQuantity={(ticketTypeId, nextQty) =>
                    setQuantities((q) => ({
                      ...q,
                      [ticketTypeId]: nextQty,
                    }))
                  }
                />
              ) : (
                <Empty title="ยังไม่มีผังเปิดจำหน่าย" />
              )}
            </div>
            {ticketTypes.length > 0 ? (
              <section className="customer-card stack">
                <h3>โซนบัตรเข้างาน</h3>
                <p className="muted">
                  คลิกเลือกโซนจากผังด้านบน หรือปรับจำนวนบัตรของโซนที่ต้องการได้ที่นี่
                </p>
                {ticketTypes.map((ticket) => {
                  const pool = data?.pools.find((p) => p.id === ticket.poolId);
                  const available = pool?.available ?? 0;
                  const others = selectedTypes
                    .filter(
                      (t) => t.poolId === ticket.poolId && t.id !== ticket.id,
                    )
                    .reduce((sum, t) => sum + quantities[t.id], 0);
                  const max = Math.min(20, Math.max(0, available - others));
                  const now = Date.parse(
                    data?.serverNow || new Date().toISOString(),
                  );
                  const onSale =
                    ticket.active &&
                    Date.parse(ticket.saleStartsAt) <= now &&
                    Date.parse(ticket.saleEndsAt) > now;
                  const zone = event.zones?.find((z) => z.id === ticket.zoneId);
                  const currentQty = quantities[ticket.id] || 0;
                  return (
                    <div
                      key={ticket.id}
                      className="zone-tier-card"
                      style={
                        currentQty > 0
                          ? {
                              borderColor: "#f59e0b",
                              background: "linear-gradient(145deg, #3d2c1480, #16161eb3)",
                            }
                          : undefined
                      }
                    >
                      <div>
                        <strong>{zone?.name || ticket.name}</strong>
                        <p>
                          {money(ticket.priceSatang)} / ใบ
                        </p>
                        <small className="muted">
                          {onSale
                            ? `คงเหลือ ${available} ใบ`
                            : "อยู่นอกช่วงจำหน่าย"}
                        </small>
                      </div>
                      <label className="field">
                        <span>จำนวนบัตร</span>
                        <select
                          value={currentQty}
                          disabled={!onSale || pending}
                          onChange={(e) =>
                            setQuantities((q) => ({
                              ...q,
                              [ticket.id]: Number(e.target.value),
                            }))
                          }
                        >
                          {Array.from(
                            {
                              length: Math.max(max, currentQty) + 1,
                            },
                            (_, n) => (
                              <option key={n} value={n} disabled={n > max}>
                                {n} ใบ
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>
                  );
                })}
              </section>
            ) : null}

            <section className="customer-card stack">
              <div
                className="between"
                style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}
              >
                <div>
                  <div className="section-kicker" style={{ marginBottom: 6 }}>
                    <span /> MY EVENT BOOKINGS
                  </div>
                  <h3 style={{ margin: 0 }}>
                    รายการจองของฉันในอีเวนต์นี้
                    {myEventBookings.length > 0
                      ? ` (${myEventBookings.length} รายการ)`
                      : ""}
                  </h3>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                    ตรวจสอบโต๊ะหรือบัตรโซนที่คุณทำรายการไว้ในงานนี้ และกดเปิดดูบัตรเข้างานได้ทันที
                  </p>
                </div>
                <Link href="/account/bookings" className="view-all-button">
                  <span>ดูการจองทั้งหมด</span>
                  <ArrowRight size={15} />
                </Link>
              </div>

              {!session?.user && !sessionPending ? (
                <div className="notice" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <span>เข้าสู่ระบบเพื่อดูรายการจองและบัตรเข้างานของคุณในอีเวนต์นี้</span>
                  <Link href={loginHref} className="mongkol-button">
                    เข้าสู่ระบบ
                  </Link>
                </div>
              ) : myBookingsResource.loading && !myBookingsResource.data ? (
                <Loading />
              ) : myEventBookings.length > 0 ? (
                <div className="booking-card-list">
                  {myEventBookings.map((booking) => {
                    const totalSeats = booking.items.reduce(
                      (sum, item) => sum + (item.admissionCount || item.quantity || 0),
                      0,
                    );
                    const isPendingPayment =
                      booking.status === "PENDING_PAYMENT";
                    const isConfirmed = booking.status === "CONFIRMED";
                    const targetHref = isPendingPayment
                      ? `/checkout/${booking.id}`
                      : `/account/bookings/${booking.id}`;
                    return (
                      <article className="booking-row" key={booking.id}>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            <Status value={booking.status} />
                            <span
                              className="muted"
                              style={{ fontSize: 12, fontWeight: 600 }}
                            >
                              #{booking.bookingNumber}
                              {booking.createdAt
                                ? ` · ${dateTime(booking.createdAt)}`
                                : ""}
                            </span>
                          </div>
                          <div
                            className="event-card-tags"
                            style={{ marginTop: 10 }}
                          >
                            {booking.items.map((item) => (
                              <span
                                key={item.id}
                                style={{
                                  background: "#22c55e1f",
                                  borderColor: "#22c55e66",
                                  color: "#dcfce7",
                                  fontSize: 12,
                                }}
                              >
                                {formatBookingItemLabel(item)}
                              </span>
                            ))}
                          </div>
                          <p
                            className="muted"
                            style={{ fontSize: 12.5, marginTop: 8 }}
                          >
                            รวมทั้งหมด {totalSeats} สิทธิ์เข้างาน
                          </p>
                        </div>
                        <div className="booking-row-right">
                          <strong>{money(booking.totalSatang)}</strong>
                          <Link href={targetHref} className="mongkol-button">
                            <TicketIcon size={15} />
                            <span>
                              {isPendingPayment
                                ? "ไปชำระเงิน"
                                : isConfirmed
                                  ? "เปิดดูบัตร / การจอง"
                                  : "ดูรายละเอียด"}
                            </span>
                            <ArrowRight size={15} />
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                  คุณยังไม่มีรายการจองในอีเวนต์นี้ เลือกโต๊ะหรือโซนจากผังด้านบนเพื่อทำรายการจองได้เลย
                </p>
              )}
            </section>
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
            {selectedUnits.length || selectedTypes.length ? (
              <ul className="summary-list">
                {selectedUnits.map((u) => (
                  <li key={u.id}>
                    <span>
                      {u.name || u.code}
                      <small>
                        {u.sellingMode === "TABLE" ? "1 โต๊ะ" : "1 ที่นั่ง"} ·{" "}
                        {u.admissionCount} สิทธิ์เข้างาน
                      </small>
                    </span>
                    <strong>{money(u.priceSatang)}</strong>
                  </li>
                ))}
                {selectedTypes.map((ticket) => {
                  const pool = data?.pools.find((p) => p.id === ticket.poolId);
                  const available = pool?.available ?? 20;
                  const maxQty = Math.min(20, Math.max(1, available));
                  const currentQty = quantities[ticket.id] || 1;
                  return (
                    <li key={ticket.id}>
                      <span>
                        {ticket.name}
                        <small>
                          บัตรเข้างานแยก {currentQty} ใบ ({money(ticket.priceSatang)} / ใบ)
                        </small>
                        <select
                          className="summary-qty-select"
                          aria-label={`จำนวนบัตร ${ticket.name}`}
                          value={currentQty}
                          disabled={pending}
                          onChange={(e) =>
                            setQuantities((q) => ({
                              ...q,
                              [ticket.id]: Number(e.target.value),
                            }))
                          }
                        >
                          <option value={0}>0 ใบ (ยกเลิก)</option>
                          {Array.from(
                            { length: Math.max(maxQty, currentQty) },
                            (_, idx) => idx + 1,
                          ).map((n) => (
                            <option key={n} value={n} disabled={n > maxQty}>
                              จำนวน {n} ใบ
                            </option>
                          ))}
                        </select>
                      </span>
                      <strong>
                        {money(ticket.priceSatang * currentQty)}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>
                คลิกเลือกโต๊ะหรือโซนที่ต้องการจากผังเพื่อทำรายการจอง
              </p>
            )}
            <div className="summary-row">
              <span className="muted">จำนวนสิทธิ์เข้างาน</span>
              <strong>{admissions} ท่าน</strong>
            </div>
            <div className="summary-row summary-total">
              <div>
                <span className="muted">ยอดชำระรวม</span>
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
                ยอมรับเงื่อนไขการจอง และชำระเงินผ่าน QR Code ภายใน 5 นาที
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
