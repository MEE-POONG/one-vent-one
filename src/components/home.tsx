"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Ticket } from "lucide-react";
import { EventCard } from "@/components/ui";
import type { EventData } from "@/lib/client-types";

type Props = { events: EventData[]; venueName: string };
const examples = ["ROOFTOP RHYTHM", "SIP & SOUL", "MIDNIGHT GROOVE", "RED ROOM NIGHTS", "LIVE SESSION", "LAST CALL"];

function Tilt({ children }: { children: React.ReactNode }) {
  function move(event: MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    event.currentTarget.style.setProperty("--tilt-x", `${y * -5}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${x * 6}deg`);
  }
  function reset(event: MouseEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
  }
  return <div className="mongkol-event" onMouseMove={move} onMouseLeave={reset}>{children}</div>;
}

export function Home({ events, venueName }: Props) {
  const [slide, setSlide] = useState(0);
  const shown = useMemo(() => events.slice(0, 6), [events]);

  useEffect(() => {
    const id = window.setInterval(() => setSlide((v) => (v + 1) % 3), 6000);
    return () => window.clearInterval(id);
  }, []);

  const hero = [
    ["OneVentOne", "NIGHTLIFE · LIVE EVENT · VIP TABLE", "คืนที่ใช่ เริ่มต้นที่นี่", "จองบัตรเข้างานและเลือกโต๊ะ VIP ล่วงหน้าได้ทันที"],
    ["RED ROOM NIGHTS", "LIVE MUSIC · DJ LINEUP · EXCLUSIVE", "ปล่อยใจไปกับจังหวะ", "พบกับศิลปินและดีเจชั้นนำทุกสุดสัปดาห์"],
    ["LIVE SESSION", "THE WEEKEND STARTS HERE", "ยกแก้วให้ค่ำคืนนี้", "บรรยากาศระดับคลับพรีเมียม ดนตรีสด และโซนที่นั่งที่ดีที่สุด"],
  ][slide];

  const display: EventData[] = shown.length
    ? shown
    : examples.map((title, index) => ({
        id: `example-${index}`,
        slug: "",
        title,
        description: "",
        artists: [],
        venue: venueName,
        posterUrl: null,
        startsAt: `2026-11-${15 + index}T19:00:00.000Z`,
        endsAt: "",
        saleStartsAt: "",
        saleEndsAt: "",
        status: "PUBLISHED",
        version: 1,
        minPriceSatang: 29900,
      }));

  return (
    <div className="mongkol-page">
      <section className={`mongkol-hero hero-slide-${slide}`} id="home">
        <Image src="/concert-hero.png" alt={`บรรยากาศคอนเสิร์ต ${venueName}`} fill priority sizes="100vw" />
        <div className="hero-noise" />
        <div className="hero-orb orb-one" />
        <div className="hero-orb orb-two" />
        <div className="hero-orb orb-three" />
        <div className="mongkol-container hero-content">
          <p className="eyebrow">{hero[1]}</p>
          <h1 className="dnxt-glitch-text_heading" data-text={hero[0]}>
            {hero[0]}
          </h1>
          <p className="hero-title">{hero[2]}</p>
          <p className="hero-copy">{hero[3]} ที่ {venueName}</p>
          <div className="hero-actions">
            <a href="#events" className="mongkol-button">
              <Ticket size={18} /> จองบัตรเลย
            </a>
            <a href="#events" className="hero-more">
              ดูตารางอีเวนต์ <ArrowRight size={17} />
            </a>
          </div>
          <div className="hero-pager">
            {[0, 1, 2].map((item) => (
              <button
                key={item}
                onClick={() => setSlide(item)}
                aria-label={`สไลด์ ${item + 1}`}
                className={item === slide ? "active" : ""}
              />
            ))}
          </div>
        </div>
        <button className="hero-arrow hero-prev" onClick={() => setSlide((slide + 2) % 3)} aria-label="สไลด์ก่อนหน้า">
          <ChevronLeft />
        </button>
        <button className="hero-arrow hero-next" onClick={() => setSlide((slide + 1) % 3)} aria-label="สไลด์ถัดไป">
          <ChevronRight />
        </button>
      </section>

      <section className="mongkol-section events-section" id="events">
        <div className="mongkol-container">
          <div className="section-kicker">
            <span /> UPCOMING LINEUP
          </div>
          <div className="mongkol-section-head">
            <div>
              <h2>อีเวนต์ที่กำลังจะมาถึง</h2>
              <p>เลือกคืนพิเศษ จองโต๊ะหรือบัตรเข้างานล่วงหน้าก่อนเต็ม</p>
            </div>
            <Link href="/events" className="view-all-button">
              ดูอีเวนต์ทั้งหมด <ArrowRight size={17} />
            </Link>
          </div>
          <div className="mongkol-event-grid">
            {display.map((event) => (
              <Tilt key={event.id}>
                <EventCard event={event} />
              </Tilt>
            ))}
          </div>
        </div>
      </section>

      <section className="mongkol-section contact-section" id="contact">
        <div className="mongkol-container">
          <div className="section-kicker">
            <span /> CONNECT WITH US
          </div>
          <div className="mongkol-section-head">
            <div>
              <h2>ติดต่อเรา</h2>
              <p>ติดตามตารางศิลปิน โปรโมชั่น และสอบถามข้อมูลเพิ่มเติมของ {venueName}</p>
            </div>
          </div>
          <div className="mongkol-contact-grid">
            <a href="#contact" className="contact-card">
              <div className="contact-card-top">
                <div className="contact-card-icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                  </svg>
                </div>
                <span className="contact-card-badge">SOCIAL</span>
              </div>
              <div className="contact-card-body">
                <span className="contact-card-label">OFFICIAL PAGE</span>
                <h3>Facebook</h3>
                <p>ติดตามตารางอีเวนต์ โปรโมชั่น และข่าวสารอัปเดตล่าสุดจากทางร้าน</p>
              </div>
              <span className="contact-card-action">
                ไปที่เพจ <ArrowRight size={16} />
              </span>
            </a>

            <a href="#contact" className="contact-card">
              <div className="contact-card-top">
                <div className="contact-card-icon" aria-hidden="true">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                  </svg>
                </div>
                <span className="contact-card-badge">GALLERY & STORY</span>
              </div>
              <div className="contact-card-body">
                <span className="contact-card-label">OFFICIAL INSTAGRAM</span>
                <h3>Instagram</h3>
                <p>ชมภาพบรรยากาศค่ำคืนสุดพิเศษและอัปเดตสตอรี่ก่อนใคร</p>
              </div>
              <span className="contact-card-action">
                ติดตามเรา <ArrowRight size={16} />
              </span>
            </a>

            <div className="contact-card contact-card-placeholder" aria-label="ช่องทางติดต่อเพิ่มเติม (เว้นไว้ก่อน)">
              <div className="contact-card-top">
                <div className="contact-card-icon" aria-hidden="true">
                  <span>+</span>
                </div>
                <span className="contact-card-badge">RESERVED</span>
              </div>
              <div className="contact-card-body">
                <span className="contact-card-label">COMING SOON</span>
                <h3>ช่องทางอื่นๆ</h3>
                <p>เว้นไว้สำหรับเพิ่มช่องทางติดต่อเพิ่มเติมในอนาคต</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

