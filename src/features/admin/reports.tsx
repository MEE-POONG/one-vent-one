"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useResource } from "@/lib/client-api";
import {
  dateTime,
  ErrorNotice,
  Field,
  Loading,
  money,
  PageHeading,
  Status,
} from "@/components/ui";
type Report = {
  serverNow: string;
  statusTotals: Record<
    string,
    { count: number; totalSatang: number; admissions: number }
  >;
  publishedEvents: number;
  reviewQueue: number;
  overdueReview: number;
  confirmedSatang: number;
  receivedSatang: number;
  refundedSatang: number;
  netReceivedSatang: number;
  soldAdmissions: number;
  checkedIn: number;
  pendingRefundCount: number;
  pendingRefundSatang: number;
};
export function Reports({ dashboard = false }: { dashboard?: boolean }) {
  const [eventId, setEventId] = useState("");
  const resource = useResource<Report>(
    `/api/admin/reports${eventId ? `?eventId=${eventId}` : ""}`,
    15000,
  );
  const events = useResource<{ items: { id: string; title: string }[] }>(
    "/api/admin/events?pageSize=100",
  );
  const data = resource.data;
  return (
    <>
      <PageHeading
        title={dashboard ? "ภาพรวมวันนี้" : "รายงานการจองและการเงิน"}
        description={
          dashboard
            ? "ติดตามอีเวนท์ ยอดการจอง และจำนวนผู้เข้างาน"
            : "ยอดจากการจองและรายได้สุทธิของแต่ละอีเวนท์"
        }
        action={
          <button className="button button-outline" onClick={resource.reload}>
            อัปเดตข้อมูล
          </button>
        }
      />
      {!dashboard ? (
        <div className="filter-bar">
          <Field label="อีเวนท์">
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">ทุกอีเวนท์</option>
              {events.data?.items.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : data ? (
        <>
          <div className="metric-grid">
            <div className="metric">
              <p>อีเวนท์เปิดขาย</p>
              <strong>{data.publishedEvents}</strong>
            </div>
            <div className="metric">
              <p>รายการจองที่ยืนยันแล้ว</p>
              <strong>{data.statusTotals.CONFIRMED?.count ?? 0}</strong>
            </div>
            <div className="metric">
              <p>ยอดการจองยืนยัน</p>
              <strong>{money(data.confirmedSatang)}</strong>
            </div>
            <div className="metric">
              <p>เข้างานแล้ว / ที่นั่งที่จอง</p>
              <strong>
                {data.checkedIn}{" "}
                <span className="muted" style={{ fontSize: 18 }}>
                  / {data.soldAdmissions}
                </span>
              </strong>
            </div>
          </div>
          <div className="section-head">
            <h2>สถานะการจอง</h2>
            {dashboard ? (
              <Link href="/admin/bookings">
                ดูรายการจองทั้งหมด <ArrowRight size={16} />
              </Link>
            ) : null}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>สถานะ</th>
                  <th>รายการ</th>
                  <th>สิทธิ์เข้า</th>
                  <th>ยอดการจอง</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.statusTotals).map(([status, summary]) => (
                  <tr key={status}>
                    <td>
                      <Status value={status} />
                    </td>
                    <td>{summary.count}</td>
                    <td>{summary.admissions}</td>
                    <td>{money(summary.totalSatang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section style={{ marginTop: 35 }}>
            <h2>เงินรับและเงินคืน</h2>
            <div className="metric-grid" style={{ marginTop: 20 }}>
              <div className="metric">
                <p>เงินรับจริงที่ตรวจแล้ว</p>
                <strong>{money(data.receivedSatang)}</strong>
              </div>
              <div className="metric">
                <p>คืนเงินจริงที่บันทึกแล้ว</p>
                <strong>{money(data.refundedSatang)}</strong>
              </div>
              <div className="metric">
                <p>เงินรับสุทธิหลังคืน</p>
                <strong>{money(data.netReceivedSatang)}</strong>
              </div>
              <div className="metric">
                <p>รอดำเนินการคืน {data.pendingRefundCount} รายการ</p>
                <strong>{money(data.pendingRefundSatang)}</strong>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              อัปเดต {dateTime(data.serverNow)} ·
              การคืนเงินจริงดำเนินการภายนอกระบบ
            </p>
          </section>
        </>
      ) : null}
    </>
  );
}
