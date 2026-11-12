import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Mic2,
  ShieldCheck,
  Ticket,
} from "lucide-react";
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
        <Link href="/events" className="view-all-button customer-back-link">
          <ArrowLeft size={17} />
          <span>กลับไปตารางอีเวนต์ทั้งหมด</span>
        </Link>

        <div className="event-detail" style={{ marginTop: 28 }}>
          <div className="stack">
            <div className="customer-card">
              <div className="section-kicker">
                <span /> EVENT OVERVIEW
              </div>
              <h1 style={{ marginTop: 12 }}>{event.title}</h1>
              <Status value={event.status} />

              <div className="event-facts">
                <p>
                  <CalendarDays size={18} />
                  <span>{dateTime(event.startsAt)}</span>
                </p>
                <p>
                  <MapPin size={18} />
                  <span>{event.venue}</span>
                </p>
              </div>

              {event.artists.length ? (
                <div className="event-artist-row">
                  <span className="event-artist-label">
                    <Mic2 size={15} /> ศิลปิน / ดีเจ:
                  </span>
                  <div className="event-card-tags" style={{ marginTop: 0 }}>
                    {event.artists.map((artist) => (
                      <span key={artist}>{artist}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="prose" style={{ marginTop: 20 }}>
                {event.description}
              </p>
            </div>

            <section className="customer-card">
              <div className="section-kicker">
                <span /> BOOKING POLICY
              </div>
              <h2 style={{ marginTop: 10, marginBottom: 16 }}>
                ข้อกำหนดก่อนจองบัตร
              </h2>
              <JsonFacts value={business?.bookingPolicy} />
              <div className="notice" style={{ marginTop: 16 }}>
                <ShieldCheck size={19} style={{ color: "#d71920" }} />
                <p>
                  เมื่อสร้างการจอง คุณมีเวลา {business?.holdMinutes || 15}{" "}
                  นาทีเพื่อโอนเงินและส่งหลักฐาน
                  การส่งสลิปยังไม่ใช่การยืนยันจนกว่าผู้ดูแลจะตรวจสอบเรียบร้อย
                </p>
              </div>
            </section>
          </div>

          <aside className="panel sticky-panel customer-sticky-card">
            <div className="section-kicker">
              <span /> SELECT ZONE
            </div>
            <h2 style={{ marginTop: 10, marginBottom: 18 }}>
              เลือกประสบการณ์ของคุณ
            </h2>

            <div className="zone-tier-list">
              {event.zones?.map((zone) => (
                <div key={zone.id} className="zone-tier-card">
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
                  <strong className="zone-tier-price">
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
            </div>

            <div className="sale-window-box">
              <Clock3 size={16} />
              <div>
                <span>ช่วงเวลาจำหน่ายบัตร</span>
                <small>
                  เปิดขาย {dateTime(event.saleStartsAt)}
                  <br />
                  ถึง {dateTime(event.saleEndsAt)}
                </small>
              </div>
            </div>

            {event.status === "PUBLISHED" ? (
              <Link
                className="mongkol-button button-wide"
                href={`/events/${event.slug}/booking`}
              >
                <Ticket size={18} />
                เลือกโต๊ะ / บัตร <ArrowRight size={18} />
              </Link>
            ) : (
              <p className="notice">ขณะนี้อีเวนต์ไม่เปิดรับการจอง</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
