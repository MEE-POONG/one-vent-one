"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Clock3,
  CheckCircle2,
  Ticket as TicketIcon,
  ScanLine,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useMutation, useResource } from "@/lib/client-api";
import type { Booking, Ticket } from "@/lib/client-types";
import {
  dateTime,
  Empty,
  ErrorNotice,
  Loading,
  money,
  PageHeading,
  Status,
} from "@/components/ui";

function HoldTimer({
  expiry,
  serverNow,
  onElapsed,
}: {
  expiry: string;
  serverNow: string;
  onElapsed: () => void;
}) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Date.parse(expiry) - Date.parse(serverNow)),
  );
  const elapsed = useRef(false);
  useEffect(() => {
    const started = performance.now();
    const duration = Date.parse(expiry) - Date.parse(serverNow);
    elapsed.current = false;
    const tick = () => {
      const left = Math.max(0, duration - (performance.now() - started));
      setRemaining(left);
      if (!left && !elapsed.current) {
        elapsed.current = true;
        onElapsed();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiry, serverNow, onElapsed]);
  return (
    <div className="countdown">
      <div className="actions">
        <Clock3 size={20} />
        <span>
          {remaining > 0 ? "ชำระเงินภายใน" : "หมดเวลาชำระเงิน"}
        </span>
      </div>
      <strong>
        {`${Math.floor(Math.ceil(remaining / 1000) / 60)}`.padStart(2, "0")}:
        {`${Math.ceil(remaining / 1000) % 60}`.padStart(2, "0")}
      </strong>
    </div>
  );
}
function QrPayment({
  booking,
  reload,
}: {
  booking: Booking;
  reload: () => Promise<void>;
}) {
  const payment = useMutation();
  const [expired, setExpired] = useState(
    Date.parse(booking.holdExpiresAt) <= Date.parse(booking.serverNow),
  );
  const [paid, setPaid] = useState(false);
  const onElapsed = useCallback(() => {
    setExpired(true);
    void reload();
  }, [reload]);
  return (
    <section className="panel customer-card demo-payment">
      <div className="between">
        <div className="section-kicker">
          <span /> QR PAYMENT
        </div>
      </div>
      <h2>สแกน QR Code เพื่อชำระเงิน</h2>
      <p className="muted">
        กรุณาสแกนชำระเงินภายในเวลา 5 นาที ระบบจะยืนยันสิทธิ์และออกบัตรเข้างานอัตโนมัติ
      </p>
      <HoldTimer
        expiry={booking.holdExpiresAt}
        serverNow={booking.serverNow}
        onElapsed={onElapsed}
      />
      <div className="demo-payment-body">
        {!expired && !paid ? (
          <div className="demo-payment-qr">
            <QRCodeSVG
              value={JSON.stringify({
                type: "ONEVENTONE_QR_PAYMENT",
                booking: booking.bookingNumber,
                amountSatang: booking.totalSatang,
                expiresAt: booking.holdExpiresAt,
              })}
              size={224}
              marginSize={4}
              level="M"
              title="QR Code สำหรับชำระเงิน"
            />
          </div>
        ) : (
          <div className="demo-payment-ended" role="status">
            {paid ? <CheckCircle2 size={40} /> : <Clock3 size={40} />}
            <h3>{paid ? "ชำระเงินสำเร็จ" : "QR Code หมดอายุแล้ว"}</h3>
            <p>
              {paid
                ? "กำลังโหลดบัตรเข้างานของคุณ"
                : "กรุณาเลือกที่นั่งและสร้างรายการจองใหม่"}
            </p>
          </div>
        )}
        <p className="muted">ยอดชำระเต็มจำนวน</p>
        <strong className="demo-payment-amount">
          {money(booking.totalSatang)}
        </strong>
        <small className="muted">{booking.bookingNumber}</small>
      </div>
      <div className="notice">
        <ScanLine size={22} />
        <p>
          เมื่อสแกนชำระเงินตามยอดด้านบนเรียบร้อยแล้ว กดปุ่มยืนยันการชำระเงินด้านล่าง
          ระบบจะยืนยันการจองและออกบัตรเข้างานดิจิทัลให้ทันที
        </p>
      </div>
      <ErrorNotice error={payment.error} />
      {expired ? (
        <Link className="mongkol-button" href={`/events/${booking.event.slug}`}>
          เลือกรายการจองใหม่
        </Link>
      ) : (
        <button
          className="mongkol-button"
          disabled={payment.pending || paid}
          onClick={async () => {
            try {
              await payment.run(`/api/bookings/${booking.id}/demo-payment`, {});
              setPaid(true);
              await reload();
            } catch {
              await reload();
            }
          }}
        >
          <CheckCircle2 size={18} />
          {payment.pending
            ? "กำลังยืนยันการชำระเงิน…"
            : paid
              ? "ชำระเงินสำเร็จ"
              : "ยืนยันการชำระเงิน"}
        </button>
      )}
    </section>
  );
}
function Tickets({ bookingId }: { bookingId: string }) {
  const resource = useResource<{ tickets: Ticket[] }>(
    `/api/bookings/${bookingId}/tickets`,
  );
  return (
    <section>
      <div className="section-head">
        <h2>บัตรเข้างานของคุณ</h2>
        <TicketIcon size={24} />
      </div>
      <div className="ticket-save-advisory">
        <div className="ticket-save-advisory-icon">
          <Smartphone size={22} />
        </div>
        <div>
          <strong>บัตรหนึ่งใบใช้ได้ตามจำนวนสิทธิ์ของรายการ</strong>
          <p>
            ระบบออกบัตรตามรายการโต๊ะ ที่นั่ง หรือโซนที่คุณจอง
            หากมาด้วยกันหลายท่าน ให้กด “เปิดดูบัตรเข้างาน”
            แล้วพลิกด้านหลังบัตรเพื่อแคปหน้าจอ (ที่มี QR Code และรหัสบัตร 8
            หลัก) ใช้แสดงต่อเจ้าหน้าที่ตอนเข้างาน
            โดยเก็บข้อมูลด้านหลังบัตรเป็นส่วนตัว
          </p>
        </div>
      </div>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.tickets.length ? (
        <div className="ticket-grid">
          {resource.data.tickets.map((ticket) => {
            const totalSeats = ticket.totalAdmissions || 1;
            const checkedIn = ticket.checkedInCount ?? 0;
            const remaining =
              ticket.remainingAdmissions ?? Math.max(0, totalSeats - checkedIn);
            return (
              <article className="ticket-card" key={ticket.id}>
                <div className="between" style={{ gap: 10, flexWrap: "wrap" }}>
                  <h3>{ticket.itemLabel || "บัตรประจำโต๊ะ"}</h3>
                  <Status value={ticket.status} />
                </div>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  บัตรเข้างานสำหรับ <strong>{totalSeats} สิทธิ์</strong> ·
                  เช็กอินแล้ว{" "}
                  <strong>
                    {checkedIn} / {totalSeats} ท่าน
                  </strong>{" "}
                  (คงเหลือ {remaining} สิทธิ์)
                </p>
                {ticket.status !== "ACTIVE" ? (
                  <p style={{ marginTop: 14, fontSize: 13 }} className="muted">
                    {ticket.usedAt
                      ? `เช็กอินครบทุกที่นั่งเมื่อ ${dateTime(ticket.usedAt)}`
                      : "บัตรนี้ไม่พร้อมใช้งาน"}
                  </p>
                ) : null}
                {ticket.token ? (
                  <Link
                    href={`/tickets/verify/${encodeURIComponent(ticket.token)}`}
                    className="mongkol-button ticket-verify-link"
                    style={{ marginTop: 14 }}
                  >
                    <TicketIcon size={16} />
                    <span>เปิดดูบัตรเข้างาน (QR & รหัส 8 หลัก)</span>
                    <ExternalLink size={14} />
                  </Link>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty title="ยังไม่มีบัตรพร้อมแสดง" />
      )}
    </section>
  );
}
export function BookingDetail({
  bookingId,
  checkout = false,
}: {
  bookingId: string;
  checkout?: boolean;
}) {
  const { data: session } = authClient.useSession();
  const resource = useResource<Booking>(`/api/bookings/${bookingId}`, 10000);
  const cancel = useMutation();
  const booking = resource.data;
  if (resource.loading) return <Loading />;
  if (resource.error)
    return (
      <div className="mongkol-page customer-page">
        <div className="mongkol-container section">
          <ErrorNotice error={resource.error} retry={resource.reload} />
        </div>
      </div>
    );
  if (!booking) return null;
  const canPay = ["PENDING_PAYMENT", "ACTION_REQUIRED"].includes(
    booking.status,
  );
  return (
    <div className="mongkol-page customer-page event-detail-page">
      <div className="event-detail-backdrop" aria-hidden="true">
        <Image
          src={booking.event?.posterUrl || "/concert-hero.png"}
          alt=""
          fill
          sizes="100vw"
          unoptimized={!!booking.event?.posterUrl?.startsWith("https:")}
        />
      </div>
      <div className="mongkol-container section event-detail-content">
        <Link
          href={
            session?.user
              ? "/account/bookings"
              : `/events/${booking.event.slug}`
          }
          className="view-all-button customer-back-link"
        >
          <ArrowLeft size={17} />
          <span>
            {session?.user
              ? "กลับไปการจองของฉัน"
              : "กลับไปหน้ารายละเอียดอีเวนต์"}
          </span>
        </Link>
        <div style={{ marginTop: 26 }}>
          <div className="section-kicker" style={{ marginBottom: 8 }}>
            <span />{" "}
            {checkout && canPay ? "CHECKOUT & PAYMENT" : "BOOKING PASS"}
          </div>
          <PageHeading
            title={
              checkout && canPay
                ? "อีกขั้นเดียว ก่อนคืนพิเศษ"
                : "รายละเอียดการจอง"
            }
            description={`เลขการจอง ${booking.bookingNumber}`}
            action={<Status value={booking.status} />}
          />
        </div>
        <div className="checkout-layout">
          <div className="stack">
            {booking.reason ? (
              <div className="notice">
                <p>หมายเหตุ: {booking.reason}</p>
              </div>
            ) : null}
            {booking.status === "CONFIRMED" ? (
              <div className="notice success-notice">
                <CheckCircle2 size={20} />
                <p>
                  ชำระเงินสำเร็จ ระบบยืนยันการจองและออกบัตรเข้างานเรียบร้อยแล้ว
                </p>
              </div>
            ) : null}
            {["EXPIRED", "REJECTED", "CANCELLED"].includes(booking.status) ? (
              <div className="notice">
                <p>
                  รายการนี้หมดเวลาชำระเงินหรือถูกยกเลิกแล้ว กรุณาเลือกรายการและสร้างการจองใหม่
                </p>
                <Link
                  className="text-link"
                  href={`/events/${booking.event.slug}`}
                >
                  จองใหม่
                </Link>
              </div>
            ) : null}
            {canPay ? (
              <QrPayment booking={booking} reload={resource.reload} />
            ) : null}
            {booking.status === "CONFIRMED" ? (
              <Tickets bookingId={booking.id} />
            ) : null}
            {booking.refunds?.length ? (
              <section className="panel customer-card">
                <h2>การคืนเงิน</h2>
                <p className="muted">
                  รายการคืนเงินของคำสั่งซื้อนี้
                </p>
                {booking.refunds.map((refund) => (
                  <div className="price-row" key={refund.id}>
                    <div>
                      <Status value={refund.status} />
                      <small>{refund.reason}</small>
                    </div>
                    <strong>{money(refund.amountSatang)}</strong>
                  </div>
                ))}
              </section>
            ) : null}
          </div>
          <aside className="panel sticky-panel customer-sticky-card">
            <div className="section-kicker" style={{ marginBottom: 8 }}>
              <span /> ORDER ITEMS
            </div>
            <h2>{booking.event?.title || "สรุปการจอง"}</h2>
            {booking.event?.startsAt ? (
              <p className="muted">{dateTime(booking.event.startsAt)}</p>
            ) : null}
            <ul className="summary-list">
              {booking.items.map((item) => (
                <li key={item.id}>
                  <span>
                    {String(
                      item.snapshot.unitName ||
                        item.snapshot.ticketTypeName ||
                        item.snapshot.unitCode ||
                        item.snapshot.zoneName ||
                        "บัตรเข้าชม",
                    )}
                    <small>
                      {item.quantity} รายการ · {item.admissionCount} สิทธิ์เข้า
                    </small>
                  </span>
                  <strong>{money(item.subtotalSatang)}</strong>
                </li>
              ))}
            </ul>
            <div className="summary-row summary-total">
              <span>ยอดรวม</span>
              <strong>{money(booking.totalSatang)}</strong>
            </div>
            {booking.status === "PENDING_PAYMENT" ? (
              <>
                <ErrorNotice error={cancel.error} />
                <button
                  className="text-link"
                  disabled={cancel.pending}
                  onClick={async () => {
                    if (
                      !window.confirm("ยกเลิกการจองนี้และคืนสิทธิ์ที่พักไว้?")
                    )
                      return;
                    try {
                      await cancel.run(`/api/bookings/${booking.id}/cancel`, {
                        version: booking.version,
                        reason: "ลูกค้ายกเลิกการจองก่อนชำระเงิน",
                      });
                      await resource.reload();
                    } catch {}
                  }}
                >
                  ยกเลิกการจองนี้
                </button>
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
