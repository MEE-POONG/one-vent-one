import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { getBusinessProfile, getEventBySlug } from "@/server/services/catalog";
import { JsonFacts, Status } from "@/components/ui";
import { dateTime, money } from "@/lib/format";
import type { Business, EventData } from "@/lib/client-types";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let event: EventData;
  let business: Business | null = null;
  try {
    const [e, b] = await Promise.all([
      getEventBySlug(slug),
      getBusinessProfile(),
    ]);
    event = JSON.parse(JSON.stringify(e));
    business = JSON.parse(JSON.stringify(b));
  } catch (error) {
    if ((error as { code?: string }).code === "NOT_FOUND") notFound();
    throw error;
  }
  return (
    <div className="container section">
      <Link href="/events" className="text-link">
        <ArrowLeft size={15} />
        อีเวนท์ทั้งหมด
      </Link>
      <div className="event-detail" style={{ marginTop: 25 }}>
        <div>
          <Image
            className="event-cover"
            src={event.posterUrl || "/concert-hero.png"}
            alt={event.title}
            width={1200}
            height={600}
            sizes="(max-width: 800px) 100vw, 65vw"
            unoptimized={!!event.posterUrl?.startsWith("https:")}
            priority
          />
          <Status value={event.status} />
          <h1>{event.title}</h1>
          <div className="event-facts">
            <p>
              <CalendarDays size={18} />
              {dateTime(event.startsAt)}
            </p>
            <p>
              <MapPin size={18} />
              {event.venue}
            </p>
          </div>
          <p className="prose">{event.description}</p>
          {event.artists.length ? (
            <p className="muted" style={{ marginTop: 20 }}>
              ศิลปิน: {event.artists.join(" · ")}
            </p>
          ) : null}
          <section style={{ marginTop: 40 }}>
            <h2>ก่อนจองบัตร</h2>
            <JsonFacts value={business?.bookingPolicy} />
            <p className="muted">
              เมื่อสร้างการจอง คุณมีเวลา {business?.holdMinutes || 15}{" "}
              นาทีเพื่อโอนและส่งหลักฐาน การส่งสลิปยังไม่ใช่การยืนยันการชำระเงิน
            </p>
          </section>
        </div>
        <aside className="panel sticky-panel">
          <h2>เลือกประสบการณ์ของคุณ</h2>
          {event.zones?.map((zone) => (
            <div key={zone.id} className="price-row">
              <div>
                <strong>{zone.name}</strong>
                <small>
                  {zone.sellingMode === "TABLE"
                    ? "จองทั้งโต๊ะ"
                    : zone.sellingMode === "SEAT"
                      ? "เลือกที่นั่ง"
                      : "บัตรเข้าชมทั่วไป"}
                </small>
                {zone.sellingMode === "TABLE" && zone.units?.[0] ? (
                  <small>
                    1 โต๊ะ · เข้าได้ {zone.units[0].admissionCount} คน
                  </small>
                ) : null}
              </div>
              <strong>
                {(() => {
                  const prices = [
                    ...(zone.units || []),
                    ...(zone.ticketTypes || []),
                  ].map((t) => t.priceSatang);
                  return prices.length ? money(Math.min(...prices)) : "—";
                })()}
              </strong>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 12, margin: "22px 0" }}>
            เปิดขาย {dateTime(event.saleStartsAt)}
            <br />
            ถึง {dateTime(event.saleEndsAt)}
          </p>
          {event.status === "PUBLISHED" ? (
            <Link
              className="button button-wide"
              href={`/events/${event.slug}/booking`}
            >
              เลือกโต๊ะ / บัตร <ArrowRight size={18} />
            </Link>
          ) : (
            <p className="notice">ขณะนี้อีเวนท์ไม่เปิดรับการจอง</p>
          )}
        </aside>
      </div>
    </div>
  );
}
