"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, MapPin, Search, Ticket } from "lucide-react";
import { EventCard } from "@/components/ui";
import type { EventData } from "@/lib/client-types";

type Props = { events: EventData[]; venueName: string };
const examples = ["ROOFTOP RHYTHM", "SIP & SOUL", "MIDNIGHT GROOVE", "RED ROOM NIGHTS", "LIVE SESSION", "LAST CALL"];

function Tilt({ children }: { children: React.ReactNode }) {
  function move(event: MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    event.currentTarget.style.setProperty("--tilt-x", `${y * -6}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${x * 7}deg`);
  }
  function reset(event: MouseEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
  }
  return <div className="mongkol-event" onMouseMove={move} onMouseLeave={reset}>{children}</div>;
}

export function MongkolHome({ events, venueName }: Props) {
  const [slide, setSlide] = useState(0);
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("ทุกจังหวัด");
  const [searched, setSearched] = useState(false);
  const shown = useMemo(() => events.slice(0, 6), [events]);
  useEffect(() => { const id = window.setInterval(() => setSlide((v) => (v + 1) % 3), 6000); return () => window.clearInterval(id); }, []);
  const hero = [["OneVentOne", "EVERY MOOD, ALL IN ONE PLACE", "คืนที่ใช่ เริ่มต้นที่นี่", "บัตรเข้าชมและโต๊ะ พร้อมให้จองแล้ว"], ["RED ROOM NIGHTS", "LIVE MUSIC · DJ · COCKTAIL", "ปล่อยใจไปกับจังหวะ", "พบกับศิลปินและดีเจทุกสุดสัปดาห์"], ["LIVE SESSION", "THE WEEKEND STARTS HERE", "ยกแก้วให้ค่ำคืนนี้", "บรรยากาศดี ดนตรีสด และเพื่อนที่ใช่"]][slide];
  const display: EventData[] = shown.length ? shown : examples.map((title, index) => ({ id: `example-${index}`, slug: "", title, description: "", artists: [], venue: "Mongkol Bar", posterUrl: null, startsAt: `2026-11-${15 + index}T19:00:00.000Z`, endsAt: "", saleStartsAt: "", saleEndsAt: "", status: "PUBLISHED", version: 1, minPriceSatang: 29900 }));
  return <div className="mongkol-page">
    <section className={`mongkol-hero hero-slide-${slide}`} id="home">
      <Image src="/concert-hero.png" alt="บรรยากาศคอนเสิร์ต Mongkol Bar" fill priority sizes="100vw" />
      <div className="hero-noise" /><div className="hero-orb orb-one" /><div className="hero-orb orb-two" /><div className="hero-orb orb-three" />
      <div className="mongkol-container hero-content"><p className="eyebrow">{hero[1]}</p><h1>{hero[0]}</h1><p className="hero-title">{hero[2]}</p><p className="hero-copy">{hero[3]} ที่ {venueName}</p><div className="hero-actions"><a href="#events" className="mongkol-button"><Ticket size={18} /> จองบัตรเลย</a><a href="#events" className="hero-more">ดูรายละเอียด <ArrowRight size={17} /></a></div><div className="hero-pager">{[0, 1, 2].map((item) => <button key={item} onClick={() => setSlide(item)} aria-label={`สไลด์ ${item + 1}`} className={item === slide ? "active" : ""} />)}</div></div>
      <button className="hero-arrow hero-prev" onClick={() => setSlide((slide + 2) % 3)} aria-label="สไลด์ก่อนหน้า"><ChevronLeft /></button><button className="hero-arrow hero-next" onClick={() => setSlide((slide + 1) % 3)} aria-label="สไลด์ถัดไป"><ChevronRight /></button>
      <form className="event-finder" onSubmit={(event) => { event.preventDefault(); setSearched(true); document.querySelector("#events")?.scrollIntoView({ behavior: "smooth" }); }}><label><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่ออีเวนต์ / ศิลปิน..." /></label><label><CalendarDays size={18} /><input type="date" aria-label="เลือกวันที่" /></label><label><MapPin size={18} /><select value={province} onChange={(event) => setProvince(event.target.value)}><option>ทุกจังหวัด</option><option>กรุงเทพมหานคร</option><option>ปทุมธานี</option><option>นนทบุรี</option></select></label><button className="mongkol-button" type="submit"><Search size={18} />ค้นหา</button></form>
    </section>
    <section className="mongkol-section events-section" id="events"><div className="mongkol-container"><div className="section-kicker"><span /> UPCOMING EXPERIENCES</div><div className="mongkol-section-head"><div><h2>อีเวนต์ที่กำลังจะมาถึง</h2><p>{searched ? `ผลลัพธ์สำหรับ “${query || province}”` : "เลือกคืนพิเศษ แล้วมาสร้างความทรงจำด้วยกัน"}</p></div></div><div className="mongkol-event-grid">{display.map((event) => <Tilt key={event.id}><EventCard event={event} /></Tilt>)}</div><div className="more-wrap"><Link href="/events" className="view-all-button">ดูอีเวนต์ทั้งหมด <ArrowRight size={17} /></Link></div></div></section>
  </div>;
}
