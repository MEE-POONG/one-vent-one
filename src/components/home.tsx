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
  Pause,
  Play,
  Ticket,
} from "lucide-react";
import { dateTime, EventCard } from "@/components/ui";
import { publicSocialLinks } from "@/shared/contact";
import type { EventData } from "@/lib/client-types";

type Props = {
  events: EventData[];
  venueName: string;
  contact: Record<string, unknown>;
};
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

export function Home({ events, venueName, contact }: Props) {
  const [slide, setSlide] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const shown = useMemo(() => events.slice(0, 6), [events]);

  const slides = useMemo<HeroSlideItem[]>(() => {
    const published = events.filter((e) => e.status === "PUBLISHED");
    const featured = published.filter((e) => e.showInSlider);
    const source = featured.length > 0 ? featured : published;

    if (source.length > 0) {
      return source.map((ev) => {
        const cleanDesc =
          (ev.description || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)[0] ||
          `จองโต๊ะล่วงหน้าได้ทันทีที่ ${ev.venue || venueName}`;
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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const syncAutoplay = () => {
      window.clearInterval(timer);
      if (autoplay && !reducedMotion.matches && !document.hidden) {
        timer = window.setInterval(() => setSlide((v) => (v + 1) % slides.length), 6000);
      }
    };
    syncAutoplay();
    reducedMotion.addEventListener("change", syncAutoplay);
    document.addEventListener("visibilitychange", syncAutoplay);
    return () => {
      window.clearInterval(timer);
      reducedMotion.removeEventListener("change", syncAutoplay);
      document.removeEventListener("visibilitychange", syncAutoplay);
    };
  }, [slides.length, autoplay]);

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
            <div
              key={item.id}
              aria-hidden={!isActive}
              className={`hero-slide-visual hero-poster-variant-${idx % 3}${isActive ? " is-active" : ""}${autoplay ? "" : " is-paused"}`}
            >
              <Image
                src={item.posterUrl}
                alt={isActive ? `บรรยากาศอีเวนต์ ${item.title}` : ""}
                fill
                priority={idx === 0}
                sizes="100vw"
                unoptimized={item.posterUrl.startsWith("https:")}
                className="hero-slide-poster"
              />
              <span className="hero-poster-sheen" aria-hidden="true" />
            </div>
          );
        })}
        <div className="hero-noise" aria-hidden="true" />
        <div className="hero-orb orb-one" aria-hidden="true" />
        <div className="hero-orb orb-two" aria-hidden="true" />
        <div className="hero-orb orb-three" aria-hidden="true" />
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
                    aria-pressed={idx === activeIndex}
                    className={idx === activeIndex ? "active" : ""}
                  />
                ))}
                <button
                  type="button"
                  className="hero-autoplay-toggle"
                  onClick={() => setAutoplay((value) => !value)}
                  aria-label={autoplay ? "หยุดสไลด์ชั่วคราว" : "เล่นสไลด์ต่อ"}
                  aria-pressed={!autoplay}
                >
                  {autoplay ? <Pause size={14} /> : <Play size={14} />}
                </button>
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
              <p>
                ติดตามตารางศิลปิน โปรโมชั่น และสอบถามข้อมูลเพิ่มเติมของ{" "}
                {venueName}
              </p>
            </div>
          </div>
          <div className="mongkol-contact-grid">
            {publicSocialLinks(contact).map((channel) => (
              <a
                key={channel.key}
                href={channel.url}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-card"
              >
                <div className="contact-card-top">
                  <div className="contact-card-icon" aria-hidden="true">
                    {channel.label.slice(0, 1)}
                  </div>
                  <span className="contact-card-badge">SOCIAL</span>
                </div>
                <div className="contact-card-body">
                  <span className="contact-card-label">FOLLOW US</span>
                  <h3>{channel.label}</h3>
                  <p>ติดตามอีเวนต์และข่าวสารจาก {venueName}</p>
                </div>
                <span className="contact-card-action">
                  ไปที่ {channel.label} <ArrowRight size={16} />
                </span>
              </a>
            ))}
            {typeof contact.phone === "string" && contact.phone ? (
              <div className="contact-card">
                <h3>โทรศัพท์</h3>
                <p>{contact.phone}</p>
              </div>
            ) : null}
            {typeof contact.line === "string" && contact.line ? (
              <div className="contact-card">
                <h3>LINE</h3>
                <p>{contact.line}</p>
              </div>
            ) : null}
            {typeof contact.email === "string" && contact.email ? (
              <a className="contact-card" href={`mailto:${contact.email}`}>
                <h3>อีเมล</h3>
                <p>{contact.email}</p>
              </a>
            ) : null}
            {publicSocialLinks(contact).length === 0 &&
            !contact.phone &&
            !contact.line &&
            !contact.email ? (
              <p className="muted">ติดตามช่องทางติดต่อจากรายละเอียดอีเวนต์</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
