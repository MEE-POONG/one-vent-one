"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Clock3,
  Upload,
  CheckCircle2,
  Ticket as TicketIcon,
} from "lucide-react";
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
          {remaining > 0 ? "ส่งหลักฐานภายใน" : "กำลังตรวจสถานะล่าสุด"}
        </span>
      </div>
      <strong>
        {`${Math.floor(remaining / 60000)}`.padStart(2, "0")}:
        {`${Math.floor(remaining / 1000) % 60}`.padStart(2, "0")}
      </strong>
    </div>
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
          <button type="submit" className="button" disabled={pending}>
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
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.tickets.length ? (
        <div className="ticket-grid">
          {resource.data.tickets.map((ticket) => (
            <article className="ticket-card" key={ticket.id}>
              <h3>{ticket.itemLabel || "บัตรเข้างาน"}</h3>
              <Status value={ticket.status} />
              {ticket.status === "ACTIVE" && ticket.token ? (
                <>
                  <div className="ticket-qr">
                    <QRCodeSVG value={ticket.token} size={176} level="M" />
                  </div>
                  <p className="muted" style={{ fontSize: 12 }}>
                    แสดงบัตรนี้กับเจ้าหน้าที่หน้างาน
                    <br />
                    หนึ่งบัตรสำหรับหนึ่งคน
                  </p>
                  <details>
                    <summary>แสดงรหัสสำหรับกรอกด้วยมือ</summary>
                    <code>{ticket.token}</code>
                  </details>
                </>
              ) : (
                <p style={{ marginTop: 20 }}>
                  {ticket.usedAt
                    ? `ใช้เมื่อ ${dateTime(ticket.usedAt)}`
                    : "บัตรนี้ไม่พร้อมใช้งาน"}
                </p>
              )}
            </article>
          ))}
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
  const resource = useResource<Booking>(`/api/bookings/${bookingId}`, 10000);
  const business = useResource<Business>("/api/business-profile");
  const cancel = useMutation();
  const booking = resource.data;
  if (resource.loading) return <Loading />;
  if (resource.error)
    return (
      <div className="container section">
        <ErrorNotice error={resource.error} retry={resource.reload} />
      </div>
    );
  if (!booking) return null;
  const canPay = ["PENDING_PAYMENT", "ACTION_REQUIRED"].includes(
    booking.status,
  );
  return (
    <div className="container section">
      <Link href="/account/bookings" className="text-link">
        <ArrowLeft size={15} />
        การจองของฉัน
      </Link>
      <div style={{ marginTop: 25 }}>
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
          {booking.status === "PENDING_PAYMENT" ? (
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
              <p>ยืนยันการจองแล้ว เตรียม QR สำหรับเข้างานได้ด้านล่าง</p>
            </div>
          ) : null}
          {["EXPIRED", "REJECTED", "CANCELLED"].includes(booking.status) ? (
            <div className="notice">
              <p>
                รายการนี้ไม่สามารถส่งหลักฐานเพิ่มเติมได้ หากโอนเงินแล้ว
                กรุณาติดต่อผู้ดูแลพร้อมเลขการจองเพื่อให้ตรวจสอบ
              </p>
            </div>
          ) : null}
          {canPay ? (
            <>
              <section className="panel">
                <h2>ช่องทางโอนเงิน</h2>
                <ErrorNotice error={business.error} retry={business.reload} />
                {business.loading && !booking.snapshot?.paymentInstructions ? (
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
            <section className="panel">
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
            <section className="panel">
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
        <aside className="panel sticky-panel">
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
                  if (!window.confirm("ยกเลิกการจองนี้และคืนสิทธิ์ที่พักไว้?"))
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
  );
}
