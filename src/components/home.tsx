"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Mic2,
  Ticket,
} from "lucide-react";
import { dateTime, EventCard } from "@/components/ui";
import type { EventData } from "@/lib/client-types";

type Props = { events: EventData[]; venueName: string };
const examples = [
  "ROOFTOP RHYTHM",
  "SIP & SOUL",
  "MIDNIGHT GROOVE",
  "RED ROOM NIGHTS",
  "LIVE SESSION",
  "LAST CALL",
];

type HeroSlideItem = {
  id: string;
  title: string;
  artistsLine: string;
  venue: string;
  startsAt: string;
  description: string;
  posterUrl: string;
  bookingHref: string;
};

// The 3D tilt now lives inside EventCard; this wrapper only keeps the grid styling.
function Tilt({ children }: { children: React.ReactNode }) {
  return <div className="mongkol-event">{children}</div>;
}

export function Home({ events, venueName }: Props) {
  const [slide, setSlide] = useState(0);
  const shown = useMemo(() => events.slice(0, 6), [events]);

  const slides = useMemo<HeroSlideItem[]>(() => {
    const published = events.filter((e) => e.status === "PUBLISHED");
    const featured = published.filter((e) => e.showInSlider);
    const source = featured.length > 0 ? featured : published;

    if (source.length > 0) {
      return source.map((ev) => {
        const cleanDesc = (ev.description || "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)[0] || `จองโต๊ะล่วงหน้าได้ทันทีที่ ${ev.venue || venueName}`;
        return {
          id: ev.id,
          title: ev.title,
          artistsLine: ev.artists?.length
            ? ev.artists.join(" · ")
            : `Live Session @ ${ev.venue || venueName}`,
          venue: ev.venue || venueName,
          startsAt: ev.startsAt,
          description: cleanDesc,
          posterUrl: ev.posterUrl || "/concert-hero.png",
          bookingHref: ev.slug ? `/events/${ev.slug}/booking` : "#events",
        };
      });
    }

    return [
      {
        id: "default-slide",
        title: "OneVentOne",
        artistsLine: "คืนที่ใช่ เริ่มต้นที่นี่",
        venue: venueName,
        startsAt: "",
        description: `จองโต๊ะเข้างานล่วงหน้าได้ทันที ที่ ${venueName}`,
        posterUrl: "/concert-hero.png",
        bookingHref: "#events",
      },
    ];
  }, [events, venueName]);

  const activeIndex = slides.length > 0 ? slide % slides.length : 0;
  const currentSlide = slides[activeIndex] ?? slides[0];

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(
      () => setSlide((v) => (v + 1) % slides.length),
      6000,
    );
    return () => window.clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    function scrollToTargetSection() {
      let target = "";
      try {
        target =
          window.sessionStorage.getItem("oneventone_scroll_target") || "";
        if (target) {
          window.sessionStorage.removeItem("oneventone_scroll_target");
        }
      } catch {
        // Ignore storage errors
      }
      if (!target && window.location.hash) {
        target = window.location.hash.replace(/^#/, "");
      }
      if (!target) return;

      const performScroll = () => {
        if (target === "home") {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        const element = document.getElementById(target);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      };

      requestAnimationFrame(performScroll);
      const timer = window.setTimeout(performScroll, 120);
      return () => window.clearTimeout(timer);
    }

    const cleanup = scrollToTargetSection();
    window.addEventListener("hashchange", scrollToTargetSection);
    return () => {
      cleanup?.();
      window.removeEventListener("hashchange", scrollToTargetSection);
    };
  }, []);

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
      <section
        className={`mongkol-hero hero-slide-${activeIndex % 3}`}
        id="home"
      >
        {slides.map((item, idx) => {
          const isActive = idx === activeIndex;
          return (
            <Image
              key={item.id}
              src={item.posterUrl}
              alt={isActive ? `บรรยากาศอีเวนต์ ${item.title}` : ""}
              fill
              priority={idx === 0}
              sizes="100vw"
              unoptimized={item.posterUrl.startsWith("https:")}
              aria-hidden={!isActive}
              className={`hero-slide-poster hero-poster-variant-${idx % 3}${isActive ? " is-active" : ""}`}
            />
          );
        })}
        <div className="hero-noise" />
        <div className="hero-orb orb-one" />
        <div className="hero-orb orb-two" />
        <div className="hero-orb orb-three" />
        <div className="mongkol-container hero-content">
          <div key={currentSlide.id} className="hero-text-stack">
            <h1
              className="dnxt-glitch-text_heading"
              data-text={currentSlide.title}
            >
              {currentSlide.title}
            </h1>
            <p className="hero-title">
              <Mic2 size={18} className="hero-inline-icon" />{" "}
              {currentSlide.artistsLine}
            </p>
            {currentSlide.startsAt ? (
              <div className="hero-event-meta">
                <span>
                  <CalendarDays size={15} />
                  {dateTime(currentSlide.startsAt)}
                </span>
                <span>
                  <MapPin size={15} />
                  {currentSlide.venue}
                </span>
              </div>
            ) : null}
            <p className="hero-copy">{currentSlide.description}</p>
          </div>
          <div className="hero-bottom-anchor">
            <div className="hero-actions">
              <Link href={currentSlide.bookingHref} className="mongkol-button">
                <Ticket size={18} /> จองโต๊ะเลย
              </Link>
              <Link href="/events" className="view-all-button hero-more">
                ดูตารางอีเวนต์ <ArrowRight size={17} />
              </Link>
            </div>
            {slides.length > 1 ? (
              <div className="hero-pager">
                {slides.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => setSlide(idx)}
                    aria-label={`สไลด์ ${idx + 1}: ${item.title}`}
                    className={idx === activeIndex ? "active" : ""}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {slides.length > 1 ? (
          <>
            <button
              className="hero-arrow hero-prev"
              onClick={() =>
                setSlide((activeIndex + slides.length - 1) % slides.length)
              }
              aria-label="สไลด์ก่อนหน้า"
            >
              <ChevronLeft />
            </button>
            <button
              className="hero-arrow hero-next"
              onClick={() => setSlide((activeIndex + 1) % slides.length)}
              aria-label="สไลด์ถัดไป"
            >
              <ChevronRight />
            </button>
          </>
        ) : null}
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

            <a href="#contact" className="contact-card">
              <div className="contact-card-top">
                <div className="contact-card-icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                  </svg>
                </div>
                <span className="contact-card-badge">CLIPS & VIBE</span>
              </div>
              <div className="contact-card-body">
                <span className="contact-card-label">OFFICIAL TIKTOK</span>
                <h3>TikTok</h3>
                <p>รับชมคลิปบรรยากาศความสนุก ไฮไลต์ศิลปิน และโมเมนต์สดจากหน้าเวที</p>
              </div>
              <span className="contact-card-action">
                ติดตาม TikTok <ArrowRight size={16} />
              </span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

