"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useResource } from "@/lib/client-api";
import type { Booking } from "@/lib/client-types";
import {
  dateTime,
  Empty,
  ErrorNotice,
  Loading,
  money,
  PageHeading,
  Pagination,
  Status,
} from "@/components/ui";
export function BookingHistory() {
  const [page, setPage] = useState(1);
  const resource = useResource<{
    bookings: Booking[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/api/me/bookings?page=${page}&pageSize=10`);
  return (
    <>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.bookings.length ? (
        <>
          <div className="booking-card-list">
            {resource.data.bookings.map((booking) => (
              <article className="booking-row" key={booking.id}>
                <div>
                  <Status value={booking.status} />
                  <h3>{booking.event?.title || booking.bookingNumber}</h3>
                  <p>
                    {booking.bookingNumber}
                    {booking.event?.startsAt
                      ? ` · ${dateTime(booking.event.startsAt)}`
                      : ""}
                  </p>
                </div>
                <div className="booking-row-right">
                  <strong>{money(booking.totalSatang)}</strong>
                  <Link
                    href={`/account/bookings/${booking.id}`}
                    className="mongkol-button"
                  >
                    ดูการจอง <ArrowRight size={15} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <Pagination {...resource.data} onChange={setPage} />
        </>
      ) : !resource.error ? (
        <Empty title="ยังไม่มีการจอง">
          <p>คืนพิเศษครั้งถัดไปกำลังรอคุณอยู่</p>
          <Link
            href="/events"
            className="mongkol-button"
            style={{ marginTop: 18 }}
          >
            เลือกอีเวนต์ <ArrowRight size={16} />
          </Link>
        </Empty>
      ) : null}
    </>
  );
}

export function BookingList() {
  return (
    <div className="mongkol-page customer-page">
      <div className="mongkol-container section">
        <div className="section-kicker" style={{ marginBottom: 8 }}>
          <span /> MY RESERVATIONS & TICKETS
        </div>
        <PageHeading
          title="การจองของฉัน"
          description="สถานะการจอง หลักฐานชำระเงิน และบัตรเข้างานในที่เดียว"
          action={
            <Link className="view-all-button" href="/events">
              ค้นหาอีเวนต์ <ArrowRight size={16} />
            </Link>
          }
        />
        <BookingHistory />
      </div>
    </div>
  );
}
