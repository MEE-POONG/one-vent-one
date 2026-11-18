"use client";
import Link from "next/link";
import { useState } from "react";
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
  const [status, setStatus] = useState(payments ? "PENDING_PAYMENT" : "");
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
        title="รายการจอง"
        description="ค้นหา ตรวจสอบสถานะการชำระเงินภายใน 5 นาที และเปิดรายละเอียดของแต่ละการจอง"
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
              "CONFIRMED",
              "EXPIRED",
              "CANCELLED",
            ].map((s) => (
              <option value={s} key={s}>
                {
                  (
                    {
                      PENDING_PAYMENT: "รอชำระเงิน (5 นาที)",
                      CONFIRMED: "ยืนยันแล้ว",
                      EXPIRED: "หมดเวลาชำระ",
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
  const { data: session } = authClient.useSession();
  const canManage = isStaff(rolesOf(session));
  const [reason, setReason] = useState("");
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
                        "บัตรเข้างาน",
                    )}
                    <small>
                      {item.quantity} รายการ · {item.admissionCount} สิทธิ์เข้างาน
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
            {booking.reason ? <p className="notice">{booking.reason}</p> : null}
            <p className="muted" style={{ fontSize: 12, marginTop: 20 }}>
              เวอร์ชัน {booking.version} ·{" "}
              {booking.event?.startsAt ? dateTime(booking.event.startsAt) : ""}
            </p>
          </section>

          {canManage &&
          ["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) ? (
            <section className="panel stack-sm">
              <h2>จัดการรายการจอง</h2>
              <Field label="เหตุผลในการยกเลิกการจอง">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  minLength={3}
                  maxLength={1000}
                  placeholder="ระบุเหตุผลการยกเลิกการจอง (อย่างน้อย 3 ตัวอักษร)"
                />
              </Field>
              <ErrorNotice error={action.error} />
              {success ? (
                <p className="notice success-notice">{success}</p>
              ) : null}
              <div className="actions">
                <button
                  className="button button-danger"
                  disabled={action.pending || reason.trim().length < 3}
                  onClick={() => {
                    if (
                      window.confirm("ยกเลิกการจองและเพิกถอนบัตรของรายการนี้?")
                    )
                      void mutate("cancel");
                  }}
                >
                  ยกเลิกการจอง
                </button>
              </div>
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
                            DEMO_PAYMENT_CONFIRMED: "ชำระเงินผ่าน QR Code สำเร็จ",
                            BOOKING_CONFIRMED: "ยืนยันการจอง",
                            BOOKING_CANCELLED: "ยกเลิกการจอง",
                            BOOKING_EXPIRED: "หมดเวลาชำระเงิน (5 นาที)",
                            REFUND_REQUESTED: "สร้างรายการคืนเงิน",
                            EXTERNAL_REFUND_RECORDED: "บันทึกคืนเงิน",
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
