"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Clock3,
  Upload,
  CheckCircle2,
  Ticket as TicketIcon,
  ScanLine,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useMutation, useResource } from "@/lib/client-api";
import type { Booking, Business, Ticket } from "@/lib/client-types";
import {
  dateTime,
  Empty,
  ErrorNotice,
  Field,
  JsonFacts,
  Loading,
  money,
  PageHeading,
  Status,
} from "@/components/ui";

function HoldTimer({
  expiry,
  serverNow,
  onElapsed,
  demo = false,
}: {
  expiry: string;
  serverNow: string;
  onElapsed: () => void;
  demo?: boolean;
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
          {remaining > 0
            ? demo
              ? "ชำระเงินภายใน"
              : "ส่งหลักฐานภายใน"
            : "หมดเวลาชำระเงิน"}
        </span>
      </div>
      <strong>
        {`${Math.floor(Math.ceil(remaining / 1000) / 60)}`.padStart(2, "0")}:
        {`${Math.ceil(remaining / 1000) % 60}`.padStart(2, "0")}
      </strong>
    </div>
  );
}
function DemoPayment({
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
        <span className="demo-payment-badge">DEMO</span>
      </div>
      <h2>สแกน QR เพื่อชำระเงิน</h2>
      <p className="muted">
        QR สำหรับรายการนี้สร้างให้อัตโนมัติ และมีอายุ 5 นาที
      </p>
      <HoldTimer
        expiry={booking.holdExpiresAt}
        serverNow={booking.serverNow}
        onElapsed={onElapsed}
        demo
      />
      <div className="demo-payment-body">
        {!expired && !paid ? (
          <div className="demo-payment-qr">
            <QRCodeSVG
              value={JSON.stringify({
                type: "ONEVENTONE_DEMO_PAYMENT",
                booking: booking.bookingNumber,
                amountSatang: booking.totalSatang,
                expiresAt: booking.holdExpiresAt,
              })}
              size={224}
              marginSize={4}
              level="M"
              title="QR ชำระเงินเดโม ไม่มีการรับเงินจริง"
            />
          </div>
        ) : (
          <div className="demo-payment-ended" role="status">
            {paid ? <CheckCircle2 size={40} /> : <Clock3 size={40} />}
            <h3>{paid ? "ชำระเงินเดโมสำเร็จ" : "QR หมดอายุแล้ว"}</h3>
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
          โหมดทดสอบ — QR นี้ไม่สามารถใช้โอนเงินจริงได้
          กดปุ่มด้านล่างเพื่อจำลองการชำระสำเร็จ
          ระบบจะยืนยันการจองและออกบัตรให้อัตโนมัติ
        </p>
      </div>
      <ErrorNotice error={payment.error} />
      {expired ? (
        <Link className="mongkol-button" href={`/events/${booking.event.slug}`}>
          เลือกที่นั่งใหม่
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
              ? "ชำระเงินเดโมสำเร็จ"
              : "ยืนยันว่าชำระแล้ว (ทดสอบ)"}
        </button>
      )}
    </section>
  );
}
function PaymentForm({
  booking,
  reload,
}: {
  booking: Booking;
  reload: () => Promise<void>;
}) {
  const upload = useMutation();
  const payment = useMutation();
  const [assetId, setAssetId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const pending = upload.pending || payment.pending;
  return (
    <section className="panel">
      <h2>
        {booking.status === "ACTION_REQUIRED"
          ? "ส่งหลักฐานที่แก้ไข"
          : "ส่งหลักฐานชำระเงิน"}
      </h2>
      {success ? (
        <p className="notice success-notice">ส่งหลักฐานแล้ว รอผู้ดูแลตรวจสอบ</p>
      ) : (
        <form
          className="stack-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            try {
              let asset = assetId;
              if (!asset) {
                const file = form.get("file");
                if (!(file instanceof File) || !file.size)
                  throw new Error("กรุณาเลือกไฟล์หลักฐาน");
                const body = new FormData();
                body.set("file", file);
                const uploaded = await upload.run<{ id: string }>(
                  `/api/bookings/${booking.id}/uploads`,
                  body,
                );
                asset = uploaded.id;
                setAssetId(asset);
              }
              await payment.run(`/api/bookings/${booking.id}/payments`, {
                assetId: asset,
                declaredAmountSatang: Math.round(
                  Number(form.get("amount")) * 100,
                ),
                transferTime: new Date(
                  String(form.get("transferTime")),
                ).toISOString(),
              });
              setSuccess(true);
              await reload();
            } catch (error) {
              if (!upload.error && !payment.error)
                payment.setError(
                  error instanceof Error
                    ? error
                    : new Error("ส่งหลักฐานไม่สำเร็จ"),
                );
            }
          }}
        >
          <Field
            label="ภาพหลักฐานการโอน"
            hint="JPEG, PNG หรือ WebP ไม่เกิน 5 MB"
          >
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp"
              required={!assetId}
              onChange={() => setAssetId(null)}
            />
          </Field>
          <div className="form-grid">
            <Field label="ยอดที่โอน (บาท)">
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={booking.totalSatang / 100}
              />
            </Field>
            <Field label="วันและเวลาโอน (ตามเวลาบนอุปกรณ์)">
              <input name="transferTime" type="datetime-local" required />
            </Field>
          </div>
          <ErrorNotice error={upload.error || payment.error} />
          <p className="muted" style={{ fontSize: 12 }}>
            หลักฐานเป็นข้อมูลส่วนตัว
            เจ้าของรายการและผู้ดูแลที่มีสิทธิ์เท่านั้นที่เปิดดูได้
          </p>
          <button type="submit" className="mongkol-button" disabled={pending}>
            <Upload size={17} />
            {pending ? "กำลังส่งหลักฐาน" : "ส่งหลักฐานให้ผู้ดูแลตรวจสอบ"}
          </button>
        </form>
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
          <strong>เปิดบัตรเข้างานจากบัญชีของคุณ</strong>
          <p>
            กด “ดูบัตรเข้างาน” เพื่อเปิดบัตรแต่ละใบและแสดงให้เจ้าหน้าที่ตรวจสอบ
            คุณสามารถกลับมาเปิดบัตรได้ที่เมนูการจองของฉัน
          </p>
        </div>
      </div>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.tickets.length ? (
        <div className="ticket-grid">
          {resource.data.tickets.map((ticket) => {
            return (
              <article className="ticket-card" key={ticket.id}>
                <div className="between" style={{ gap: 10 }}>
                  <h3>{ticket.itemLabel || "บัตรเข้างาน"}</h3>
                  <Status value={ticket.status} />
                </div>
                <small className="muted">
                  ลำดับสิทธิ์ใบที่ {ticket.admissionSequence}
                </small>
                {ticket.status !== "ACTIVE" ? (
                  <p style={{ marginTop: 20 }}>
                    {ticket.usedAt
                      ? `ใช้เข้างานเมื่อ ${dateTime(ticket.usedAt)}`
                      : "บัตรนี้ไม่พร้อมใช้งาน"}
                  </p>
                ) : null}
                {ticket.token ? (
                  <Link
                    href={`/tickets/verify/${encodeURIComponent(ticket.token)}`}
                    className="mongkol-button ticket-verify-link"
                    style={{ marginTop: 12 }}
                  >
                    <TicketIcon size={16} />
                    <span>ดูบัตรเข้างาน</span>
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
  const business = useResource<Business>("/api/business-profile");
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
  const isDemo = booking.snapshot?.paymentMode === "DEMO_QR";
  const canPay = ["PENDING_PAYMENT", "ACTION_REQUIRED"].includes(
    booking.status,
  );
  return (
    <div className="mongkol-page customer-page">
      <div className="mongkol-container section">
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
            {booking.status === "PENDING_PAYMENT" && !isDemo ? (
              <HoldTimer
                expiry={booking.holdExpiresAt}
                serverNow={booking.serverNow}
                onElapsed={resource.reload}
              />
            ) : null}
            {["PENDING_REVIEW", "ACTION_REQUIRED"].includes(booking.status) ? (
              <div className="notice">
                <Clock3 size={20} />
                <div>
                  <p>
                    {booking.status === "PENDING_REVIEW"
                      ? "ส่งหลักฐานแล้ว รอผู้ดูแลตรวจสอบ"
                      : "กรุณาแก้ไขหลักฐานตามคำแนะนำของผู้ดูแล"}
                  </p>
                  <p>
                    ระบบคงสิทธิ์ของคุณระหว่างตรวจสอบ จะออกบัตรหลังผู้ดูแลอนุมัติ
                  </p>
                </div>
              </div>
            ) : null}
            {booking.reason ? (
              <div className="notice">
                <p>ข้อความจากผู้ดูแล: {booking.reason}</p>
              </div>
            ) : null}
            {booking.status === "CONFIRMED" ? (
              <div className="notice success-notice">
                <CheckCircle2 size={20} />
                <p>
                  {isDemo
                    ? "ชำระเงินเดโมสำเร็จ ระบบยืนยันการจองและออกบัตรให้อัตโนมัติแล้ว (ไม่มีการรับเงินจริง)"
                    : "ยืนยันการจองแล้ว กดดูบัตรเข้างานได้ด้านล่าง"}
                </p>
              </div>
            ) : null}
            {["EXPIRED", "REJECTED", "CANCELLED"].includes(booking.status) ? (
              <div className="notice">
                <p>
                  {isDemo
                    ? "รายการนี้สิ้นสุดแล้ว QR ไม่สามารถใช้ได้ กรุณาสร้างรายการจองใหม่เพื่อทดสอบชำระเงิน"
                    : "รายการนี้ไม่สามารถส่งหลักฐานเพิ่มเติมได้ หากโอนเงินแล้ว กรุณาติดต่อผู้ดูแลพร้อมเลขการจองเพื่อให้ตรวจสอบ"}
                </p>
                {isDemo ? (
                  <Link
                    className="text-link"
                    href={`/events/${booking.event.slug}`}
                  >
                    จองใหม่
                  </Link>
                ) : null}
              </div>
            ) : null}
            {canPay && isDemo ? (
              <DemoPayment booking={booking} reload={resource.reload} />
            ) : canPay ? (
              <>
                <section className="panel customer-card">
                  <div className="section-kicker" style={{ marginBottom: 8 }}>
                    <span /> BANK TRANSFER
                  </div>
                  <h2>ช่องทางโอนเงิน</h2>
                  <ErrorNotice error={business.error} retry={business.reload} />
                  {business.loading &&
                  !booking.snapshot?.paymentInstructions ? (
                    <Loading />
                  ) : null}
                  {booking.snapshot?.paymentInstructions || business.data ? (
                    <>
                      <JsonFacts
                        value={
                          booking.snapshot?.paymentInstructions ||
                          business.data?.paymentInstructions
                        }
                      />
                      <div className="summary-row summary-total">
                        <span>ยอดชำระเต็มจำนวน</span>
                        <strong>{money(booking.totalSatang)}</strong>
                      </div>
                    </>
                  ) : null}
                </section>
                <PaymentForm booking={booking} reload={resource.reload} />
              </>
            ) : null}
            {booking.status === "CONFIRMED" ? (
              <Tickets bookingId={booking.id} />
            ) : null}
            {booking.payments?.length ? (
              <section className="panel customer-card">
                <h2>ประวัติหลักฐาน</h2>
                <ul className="history-list">
                  {booking.payments.map((payment, index) => (
                    <li key={payment.id}>
                      <div className="between">
                        <strong>หลักฐาน #{index + 1}</strong>
                        <Status value={payment.status} />
                      </div>
                      <p>
                        ยอดแจ้ง {money(payment.declaredAmountSatang)} ·{" "}
                        {dateTime(payment.transferTime)}
                      </p>
                      {payment.reviewReason ? (
                        <p>{payment.reviewReason}</p>
                      ) : null}
                      <a
                        className="text-link"
                        href={`/api/private-assets/${payment.assetId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        เปิดหลักฐาน
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {booking.refunds?.length ? (
              <section className="panel customer-card">
                <h2>การคืนเงิน</h2>
                <p className="muted">
                  ผู้ดูแลดำเนินการคืนเงินภายนอกและบันทึกผลในระบบ
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
