"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useMutation, useResource } from "@/lib/client-api";
import type { Booking } from "@/lib/client-types";
import {
  dateTime,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  money,
  PageHeading,
  Pagination,
  Status,
} from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { isStaff, rolesOf } from "@/lib/roles";
export function AdminBookings({ payments = false }: { payments?: boolean }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(payments ? "PENDING_REVIEW" : "");
  const [q, setQ] = useState("");
  const resource = useResource<{
    bookings: Booking[];
    total: number;
    page: number;
    pageSize: number;
  }>(
    `/api/admin/bookings?page=${page}&pageSize=15&status=${status}&q=${encodeURIComponent(q)}`,
    10000,
  );
  return (
    <>
      <PageHeading
        title={payments ? "ตรวจชำระเงิน" : "รายการจอง"}
        description={
          payments
            ? "ตรวจเงินจริงก่อนอนุมัติ หลักฐานที่ส่งเข้ามายังไม่ใช่ยอดเงินรับ"
            : "ค้นหา ตรวจสถานะ และเปิดรายละเอียดของแต่ละการจอง"
        }
      />
      <div className="filter-bar">
        <Field label="ค้นหาเลขการจอง">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="MKB-..."
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
            <option value="">ทั้งหมด</option>
            {[
              "PENDING_PAYMENT",
              "PENDING_REVIEW",
              "ACTION_REQUIRED",
              "CONFIRMED",
              "EXPIRED",
              "REJECTED",
              "CANCELLED",
            ].map((s) => (
              <option value={s} key={s}>
                {
                  (
                    {
                      PENDING_PAYMENT: "รอชำระ",
                      PENDING_REVIEW: "รอตรวจสอบ",
                      ACTION_REQUIRED: "ขอแก้ไข",
                      CONFIRMED: "ยืนยันแล้ว",
                      EXPIRED: "หมดเวลา",
                      REJECTED: "ไม่อนุมัติ",
                      CANCELLED: "ยกเลิก",
                    } as Record<string, string>
                  )[s]
                }
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.bookings.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>การจอง</th>
                  <th>ยอดรวม</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <strong>{booking.bookingNumber}</strong>
                      <small>{booking.event?.title}</small>
                      {booking.createdAt ? (
                        <small>{dateTime(booking.createdAt)}</small>
                      ) : null}
                    </td>
                    <td>{money(booking.totalSatang)}</td>
                    <td>
                      <Status value={booking.status} />
                    </td>
                    <td>
                      <Link
                        className="button button-outline button-small"
                        href={`/admin/bookings/${booking.id}`}
                      >
                        ดูรายละเอียด
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...resource.data} onChange={setPage} />
        </>
      ) : !resource.error ? (
        <Empty title="ไม่มีรายการในสถานะนี้" />
      ) : null}
    </>
  );
}
export function AdminBookingDetail({ id }: { id: string }) {
  const resource = useResource<Booking>(`/api/bookings/${id}`);
  const action = useMutation();
  const upload = useMutation();
  const evidenceCache = useRef<Record<string, string>>({});
  async function evidence(file: File, scope: string) {
    const bytes = await file.arrayBuffer();
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    const cacheKey = scope + ":" + digest;
    if (evidenceCache.current[cacheKey])
      return { id: evidenceCache.current[cacheKey] };
    const body = new FormData();
    body.set("file", file);
    const asset = await upload.run<{ id: string }>(
      "/api/bookings/" + id + "/uploads",
      body,
    );
    evidenceCache.current[cacheKey] = asset.id;
    return asset;
  }
  const { data: session } = authClient.useSession();
  const canReview = isStaff(rolesOf(session));
  const [reason, setReason] = useState("");
  const [received, setReceived] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("");
  const [success, setSuccess] = useState("");
  const booking = resource.data;
  async function mutate(
    operation: string,
    extra: Record<string, unknown> = {},
  ) {
    if (!booking) return;
    setSuccess("");
    try {
      await action.run(`/api/admin/bookings/${id}/${operation}`, {
        version: booking.version,
        reason,
        ...extra,
      });
      setSuccess("บันทึกผลแล้ว");
      await resource.reload();
    } catch {}
  }
  if (resource.loading) return <Loading />;
  return (
    <>
      <PageHeading
        title={booking?.bookingNumber || "รายละเอียดการจอง"}
        description={booking?.event?.title}
        action={booking ? <Status value={booking.status} /> : null}
      />
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {booking ? (
        <div className="stack">
          <div className="admin-grid">
            <section className="panel">
              <h2>สรุปการจอง</h2>
              <ul className="summary-list">
                {booking.items.map((item) => (
                  <li key={item.id}>
                    <span>
                      {String(
                        item.snapshot.unitName ||
                          item.snapshot.ticketTypeName ||
                          item.snapshot.unitCode ||
                          item.snapshot.zoneName ||
                          "บัตร",
                      )}
                      <small>
                        {item.quantity} รายการ · {item.admissionCount} คน
                      </small>
                    </span>
                    <strong>{money(item.subtotalSatang)}</strong>
                  </li>
                ))}
              </ul>
              <div className="summary-row summary-total">
                <span>ยอดการจอง</span>
                <strong>{money(booking.totalSatang)}</strong>
              </div>
              {booking.reason ? (
                <p className="notice">{booking.reason}</p>
              ) : null}
              <p className="muted" style={{ fontSize: 12, marginTop: 20 }}>
                เวอร์ชัน {booking.version} ·{" "}
                {booking.event?.startsAt
                  ? dateTime(booking.event.startsAt)
                  : ""}
              </p>
            </section>
            <section className="panel">
              <h2>หลักฐานชำระเงิน</h2>
              {booking.payments?.length ? (
                <ul className="history-list">
                  {booking.payments.map((payment, index) => (
                    <li key={payment.id}>
                      <div className="between">
                        <strong>ครั้งที่ {index + 1}</strong>
                        <Status value={payment.status} />
                      </div>
                      <p>ยอดแจ้ง {money(payment.declaredAmountSatang)}</p>
                      {payment.duplicateEvidenceWarning ? (
                        <p className="notice">
                          พบภาพหลักฐานที่ซ้ำกับรายการอื่น
                          กรุณาตรวจข้อมูลและยอดเงินเข้าจริงเพิ่มเติม
                        </p>
                      ) : null}
                      <p>{dateTime(payment.transferTime)}</p>
                      {payment.receivedAmountSatang != null ? (
                        <p>
                          ยอดรับจริงที่ตรวจ{" "}
                          {money(payment.receivedAmountSatang)}
                        </p>
                      ) : null}
                      {payment.reviewReason ? (
                        <p>{payment.reviewReason}</p>
                      ) : null}
                      {canReview ? (
                        <a
                          className="text-link"
                          href={`/api/private-assets/${payment.assetId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          เปิดภาพหลักฐาน
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">ยังไม่มีหลักฐาน</p>
              )}
            </section>
          </div>
          {canReview ? (
            <section className="panel stack-sm">
              <h2>บันทึกผลการตรวจสอบ</h2>
              <div className="notice">
                ตรวจยอดเงินเข้าจากบัญชีรับเงินของร้านให้ครบถ้วนก่อนอนุมัติ
                ระบบจะออกบัตรเมื่อบันทึกการอนุมัติสำเร็จ
              </div>
              <div className="form-grid">
                <Field label="หลักฐานที่ตรวจ">
                  <select
                    value={selectedPayment}
                    onChange={(e) => setSelectedPayment(e.target.value)}
                  >
                    <option value="">เลือกหลักฐาน</option>
                    {booking.payments
                      .filter((p) => p.status === "SUBMITTED")
                      .map((p, i) => (
                        <option key={p.id} value={p.id}>
                          หลักฐาน #{i + 1} · {money(p.declaredAmountSatang)}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="ยอดรับเงินจริง (บาท)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={received}
                    onChange={(e) => setReceived(e.target.value)}
                  />
                </Field>
                <div className="full">
                  <Field label="เหตุผล / หมายเหตุการดำเนินการ">
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      minLength={3}
                      maxLength={1000}
                      placeholder="ระบุผลการตรวจหรือเหตุผลที่ลูกค้าต้องแก้ไข"
                    />
                  </Field>
                </div>
              </div>
              <ErrorNotice error={action.error || upload.error} />
              {success ? (
                <p className="notice success-notice">{success}</p>
              ) : null}
              <div className="actions">
                {booking.status === "PENDING_REVIEW" ? (
                  <>
                    <button
                      className="button"
                      disabled={
                        action.pending ||
                        reason.trim().length < 3 ||
                        !selectedPayment ||
                        !received
                      }
                      onClick={() =>
                        mutate("approve", {
                          paymentAttemptId: selectedPayment,
                          receivedAmountSatang: Math.round(
                            Number(received) * 100,
                          ),
                        })
                      }
                    >
                      ตรวจเงินแล้ว · อนุมัติและออกบัตร
                    </button>
                    <button
                      className="button button-outline"
                      disabled={action.pending || reason.trim().length < 3}
                      onClick={() => mutate("request-correction")}
                    >
                      ขอแก้ไขหลักฐาน
                    </button>
                  </>
                ) : null}
                {["PENDING_REVIEW", "ACTION_REQUIRED"].includes(
                  booking.status,
                ) ? (
                  <button
                    className="button button-danger"
                    disabled={action.pending || reason.trim().length < 3}
                    onClick={() => mutate("reject")}
                  >
                    ไม่อนุมัติและคืนสิทธิ์
                  </button>
                ) : null}
                {[
                  "PENDING_PAYMENT",
                  "PENDING_REVIEW",
                  "ACTION_REQUIRED",
                  "CONFIRMED",
                ].includes(booking.status) ? (
                  <button
                    className="button button-outline"
                    disabled={action.pending || reason.trim().length < 3}
                    onClick={() => {
                      if (
                        window.confirm(
                          "ยกเลิกการจองและเพิกถอนบัตรของรายการนี้?",
                        )
                      )
                        void mutate("cancel");
                    }}
                  >
                    ยกเลิกการจอง
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}
          {booking.refunds?.length ? (
            <section className="panel">
              <h2>รายการคืนเงิน</h2>
              <p className="muted">
                คืนเงินเต็มจำนวนภายนอกระบบ แล้วอัปโหลดหลักฐานเพื่อบันทึกผล
                ปุ่มนี้ไม่ได้โอนเงิน
              </p>
              {booking.refunds.map((refund) => (
                <div key={refund.id} style={{ paddingTop: 24 }}>
                  <div className="between">
                    <strong>{money(refund.amountSatang)}</strong>
                    <Status value={refund.status} />
                  </div>
                  <p className="muted">{refund.reason}</p>
                  {canReview && refund.status === "PENDING" ? (
                    <form
                      className="stack-sm"
                      style={{ marginTop: 20 }}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        const file = form.get("file");
                        if (!(file instanceof File)) return;
                        const body = new FormData();
                        body.set("file", file);
                        try {
                          const asset = await evidence(file, refund.id);
                          await action.run(
                            `/api/admin/bookings/${id}/refunds/${refund.id}/complete`,
                            {
                              proofAssetId: asset.id,
                              reason: String(form.get("reason")),
                            },
                          );
                          await resource.reload();
                        } catch {}
                      }}
                    >
                      <Field label="หลักฐานคืนเงินจริง">
                        <input
                          type="file"
                          name="file"
                          required
                          accept="image/png,image/jpeg,image/webp"
                        />
                      </Field>
                      <Field label="รายละเอียดการคืนเงิน">
                        <input name="reason" minLength={3} required />
                      </Field>
                      <button
                        className="button"
                        disabled={action.pending || upload.pending}
                      >
                        บันทึกว่าคืนเงินจริงแล้ว
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}
          {canReview &&
          ["EXPIRED", "CANCELLED", "REJECTED"].includes(booking.status) &&
          !booking.payments.some((p) => p.status === "VERIFIED") ? (
            <section className="panel">
              <h2>รับหลักฐานโอนล่าช้าเพื่อคืนเงิน</h2>
              <p className="muted">
                ใช้เมื่อพบเงินรับจริงหลังรายการสิ้นสุด
                บันทึกเงินรับและคิวคืนเงินโดยไม่คืนชีพการจองหรือออกบัตร
              </p>
              <form
                className="stack-sm"
                style={{ marginTop: 20 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const file = f.get("file");
                  if (!(file instanceof File)) return;
                  const body = new FormData();
                  body.set("file", file);
                  try {
                    const asset = await evidence(file, "late-receipt");
                    await mutate("record-received", {
                      assetId: asset.id,
                      reason: String(f.get("reason")),
                      declaredAmountSatang: Math.round(
                        Number(f.get("amount")) * 100,
                      ),
                      transferTime: new Date(
                        String(f.get("transferTime")),
                      ).toISOString(),
                    });
                  } catch {}
                }}
              >
                <Field label="หลักฐานที่ตรวจพบเงินรับแล้ว">
                  <input
                    type="file"
                    name="file"
                    required
                    accept="image/png,image/jpeg,image/webp"
                  />
                </Field>
                <div className="form-grid">
                  <Field label="ยอดรับจริง (บาท)">
                    <input
                      type="number"
                      name="amount"
                      required
                      min="0.01"
                      step="0.01"
                    />
                  </Field>
                  <Field label="วันและเวลาโอน (เวลาอุปกรณ์)">
                    <input name="transferTime" type="datetime-local" required />
                  </Field>
                </div>
                <Field label="เหตุผล">
                  <input name="reason" required minLength={3} />
                </Field>
                <button
                  className="button button-outline"
                  disabled={action.pending || upload.pending}
                >
                  บันทึกเงินรับและคิวคืนเงิน
                </button>
              </form>
            </section>
          ) : null}
          <section className="panel">
            <h2>ประวัติการดำเนินการ</h2>
            {booking.auditTimeline?.length ? (
              <ul className="history-list">
                {booking.auditTimeline.map((entry, index) => (
                  <li key={index}>
                    <div className="between">
                      <strong>
                        {(
                          {
                            BOOKING_CREATED: "สร้างการจอง",
                            PAYMENT_SUBMITTED: "ส่งหลักฐานชำระ",
                            BOOKING_CONFIRMED: "อนุมัติการจอง",
                            PAYMENT_VERIFIED: "ตรวจเงินจริงแล้ว",
                            PAYMENT_CORRECTION_REQUESTED: "ขอแก้ไขหลักฐาน",
                            BOOKING_CANCELLED: "ยกเลิกการจอง",
                            BOOKING_REJECTED: "ปฏิเสธการจอง",
                            BOOKING_EXPIRED: "หมดเวลาชำระ",
                            REFUND_REQUESTED: "สร้างรายการคืนเงิน",
                            EXTERNAL_REFUND_RECORDED: "บันทึกคืนเงินจริง",
                            LATE_PAYMENT_RECORDED: "บันทึกเงินรับล่าช้า",
                          } as Record<string, string>
                        )[entry.action] || "ปรับปรุงรายการ"}
                      </strong>
                      <small className="muted">
                        {dateTime(entry.createdAt)}
                      </small>
                    </div>
                    {entry.reason ? <p>{entry.reason}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">ยังไม่มีประวัติการดำเนินการ</p>
            )}
          </section>
          <Link href="/admin/bookings" className="text-link">
            กลับไปรายการจอง
          </Link>
        </div>
      ) : null}
    </>
  );
}
