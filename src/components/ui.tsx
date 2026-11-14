"use client";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  ArrowRight,
  LoaderCircle,
  MapPin,
  Ticket as TicketIcon,
} from "lucide-react";
import { useRef } from "react";
import type {
  CSSProperties,
  HTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";
import { ApiError } from "@/lib/client-api";
import type { EventData } from "@/lib/client-types";

export const money = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: value % 100 ? 2 : 0,
  }).format(value / 100);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
export const dateOnly = (value: string) =>
  new Intl.DateTimeFormat("th-TH", {
    dateStyle: "long",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
const statuses: Record<string, string> = {
  AVAILABLE: "ว่าง",
  HELD: "พักสิทธิ์ชั่วคราว",
  REVIEW_RESERVED: "รอตรวจชำระ",
  SOLD: "ขายแล้ว",
  BLOCKED: "ปิดการขาย",
  PENDING_PAYMENT: "รอชำระเงิน",
  PENDING_REVIEW: "รอผู้ดูแลตรวจสอบ",
  ACTION_REQUIRED: "กรุณาแก้ไขหลักฐาน",
  CONFIRMED: "ยืนยันการจอง",
  EXPIRED: "หมดเวลาชำระ",
  REJECTED: "ไม่อนุมัติ",
  CANCELLED: "ยกเลิก",
  ACTIVE: "พร้อมใช้งาน",
  USED: "เข้างานแล้ว",
  REVOKED: "เพิกถอน",
  DRAFT: "ฉบับร่าง",
  PUBLISHED: "เปิดขาย",
  CLOSED: "ปิดขาย",
  COMPLETED: "สิ้นสุดงาน",
  PENDING: "รอดำเนินการ",
  REFUNDED: "คืนเงินแล้ว",
  SUBMITTED: "ส่งหลักฐานแล้ว",
  VERIFIED: "ตรวจเงินแล้ว",
};
export const statusText = (status: string) => statuses[status] || status;
export const modeText = (mode: string) =>
  ({ TABLE: "โต๊ะ", SEAT: "ที่นั่ง", GENERAL_ADMISSION: "บัตรเข้าชม" })[mode] ||
  mode;
export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>
      <span aria-hidden="true" />
      {statusText(value)}
    </span>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <div role="alert" className="notice error-notice">
      <AlertCircle size={19} />
      <div>
        <p>{error.message}</p>
        {error instanceof ApiError && error.fieldErrors ? (
          <ul>
            {Object.entries(error.fieldErrors).map(([key, errors]) => (
              <li key={key}>
                {key}: {errors.join(", ")}
              </li>
            ))}
          </ul>
        ) : null}
        {error instanceof ApiError && error.status === 401 ? (
          <Link href="/login" className="text-link">
            เข้าสู่ระบบเพื่อดำเนินการต่อ <ArrowRight size={15} />
          </Link>
        ) : retry ? (
          <button onClick={retry} className="text-link">
            ลองอีกครั้ง
          </button>
        ) : null}
      </div>
    </div>
  );
}
export function Loading({ label = "กำลังโหลดข้อมูล" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={22} className="spinner" />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <TicketIcon size={36} />
      <h3>{title}</h3>
      {children ? <div className="muted">{children}</div> : null}
    </div>
  );
}
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
export function Highlight({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`highlight ${className}`}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty(
          "--pointer-x",
          `${e.clientX - rect.left}px`,
        );
        e.currentTarget.style.setProperty(
          "--pointer-y",
          `${e.clientY - rect.top}px`,
        );
      }}
    >
      {children}
    </div>
  );
}
// Fixed particle positions (percent of the poster) so server and client render
// the same markup. They sit behind the artist layer and only show on hover.
const CARD_PARTICLES: ReadonlyArray<readonly [number, number, number, number]> =
  [
    // left %, top %, size px, delay s
    [12, 72, 5, 0],
    [22, 48, 3, 0.6],
    [16, 26, 4, 1.2],
    [34, 16, 3, 0.3],
    [52, 10, 5, 0.9],
    [70, 18, 3, 1.5],
    [84, 34, 4, 0.2],
    [88, 58, 3, 1.1],
    [78, 78, 5, 0.7],
    [30, 84, 3, 1.4],
  ];

export function EventCard({ event }: { event: EventData }) {
  const shineRef = useRef<HTMLSpanElement>(null);
  const shoneRef = useRef(false);
  const startsAt = new Date(event.startsAt);
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(startsAt);
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: "Asia/Bangkok",
  })
    .format(startsAt)
    .toUpperCase();
  const year = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(startsAt);
  const modes = [...new Set(event.zones?.map((zone) => zone.sellingMode))];
  const detailsHref = event.slug ? `/events/${event.slug}` : "/events";
  const isPublished = event.status === "PUBLISHED";
  const artistSrc = event.artistImageUrl || "";

  // Write pointer CSS variables immediately so even a quick pass tilts smoothly.
  function applyPointer(e: MouseEvent<HTMLElement>) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    el.style.setProperty("--card-rx", `${((0.5 - y) * 7).toFixed(2)}deg`);
    el.style.setProperty("--card-ry", `${((x - 0.5) * 9).toFixed(2)}deg`);
    el.style.setProperty("--card-mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--card-my", `${(y * 100).toFixed(1)}%`);
    el.style.setProperty("--card-dx", (x - 0.5).toFixed(3));
    el.style.setProperty("--card-dy", (y - 0.5).toFixed(3));
  }
  function triggerShine() {
    shoneRef.current = true;
    const shine = shineRef.current;
    if (!shine) return;
    shine.classList.remove("is-shining");
    shine.getBoundingClientRect();
    shine.classList.add("is-shining");
  }
  function onEnter(e: MouseEvent<HTMLElement>) {
    applyPointer(e);
    triggerShine();
  }
  function onMove(e: MouseEvent<HTMLElement>) {
    applyPointer(e);
    if (!shoneRef.current) triggerShine();
  }
  function onLeave(e: MouseEvent<HTMLElement>) {
    shoneRef.current = false;
    const el = e.currentTarget;
    for (const name of [
      "--card-rx",
      "--card-ry",
      "--card-mx",
      "--card-my",
      "--card-dx",
      "--card-dy",
    ])
      el.style.removeProperty(name);
  }

  return (
    <article
      className={`event-card${artistSrc ? " has-artist" : ""}`}
      onMouseEnter={onEnter}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <Link
        className="event-card-poster"
        href={detailsHref}
        aria-label={`ดู ${event.title}`}
      >
        <span className="event-card-layer event-card-bg" aria-hidden="true">
          <Image
            src={event.posterUrl || "/concert-hero.png"}
            alt=""
            fill
            sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1000px) 45vw, 384px"
            unoptimized={!!event.posterUrl?.startsWith("https:")}
          />
        </span>
        <span className="event-card-layer event-card-aura" aria-hidden="true" />
        <span
          className="event-card-layer event-card-particles"
          aria-hidden="true"
        >
          {CARD_PARTICLES.map(([left, top, size, delay], i) => (
            <i
              key={i}
              style={
                {
                  left: `${left}%`,
                  top: `${top}%`,
                  width: size,
                  height: size,
                  animationDelay: `${delay}s`,
                } as CSSProperties
              }
            />
          ))}
        </span>
        {artistSrc ? (
          <span className="event-card-artist" aria-hidden="true">
            <Image
              src={artistSrc}
              alt=""
              fill
              sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1000px) 45vw, 384px"
              unoptimized={artistSrc.startsWith("https:")}
            />
          </span>
        ) : null}
        <span className="event-card-layer event-card-glare" aria-hidden="true" />
        <time
          className="event-card-date"
          dateTime={event.startsAt}
          aria-label={dateTime(event.startsAt)}
        >
          <strong>{day}</strong>
          <span>
            {month} {year}
          </span>
        </time>
        <span className={`event-card-badge ${isPublished ? "is-live" : ""}`}>
          <span className="event-card-badge-dot" aria-hidden="true" />
          {isPublished ? "เปิดขายบัตร" : statusText(event.status)}
        </span>
      </Link>
      <span
        ref={shineRef}
        className="event-card-shine"
        aria-hidden="true"
        onAnimationEnd={(e) => e.currentTarget.classList.remove("is-shining")}
      />
      <div className="event-card-content">
        <h3>
          <Link href={detailsHref}>{event.title}</Link>
        </h3>
        <p className="event-card-venue">
          <MapPin size={15} aria-hidden="true" />
          {event.venue}
        </p>
        {event.artists?.length ? (
          <p className="event-card-artists">{event.artists.join(" · ")}</p>
        ) : null}
        {modes.length ? (
          <div className="event-card-tags" aria-label="รูปแบบบัตร">
            {modes.map((mode) => (
              <span key={mode}>#{modeText(mode)}</span>
            ))}
          </div>
        ) : null}
        <div className="event-card-action">
          <div className="event-card-price">
            <span>ราคาเริ่มต้น</span>
            <strong>
              {typeof event.minPriceSatang === "number"
                ? money(event.minPriceSatang)
                : "รอประกาศราคา"}
            </strong>
          </div>
          <Link
            href={
              isPublished && event.slug
                ? `${detailsHref}/booking`
                : detailsHref
            }
            className="event-card-cta"
            aria-label={`${isPublished ? "จองบัตร" : "ดูรายละเอียด"} ${event.title}`}
          >
            {isPublished ? "จองบัตร" : "รายละเอียด"}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
export function JsonFacts({ value }: { value?: Record<string, unknown> }) {
  if (!value) return null;
  return (
    <dl className="facts">
      {Object.entries(value)
        .filter(([, v]) => typeof v === "string" || typeof v === "number")
        .map(([k, v]) => {
          const normalized =
            k === "holdMinutes" && Number(v) === 15
              ? "5"
              : k === "terms" && typeof v === "string"
                ? v.replace(/ภายใน\s*15\s*นาที/g, "ภายใน 5 นาที")
                : String(v);
          return (
            <div key={k}>
              <dt>
                {(
                  {
                    bankName: "ธนาคาร",
                    accountName: "ชื่อบัญชี",
                    accountNumber: "เลขบัญชี",
                    note: "หมายเหตุ",
                    phone: "โทรศัพท์",
                    address: "ที่อยู่",
                    line: "LINE",
                    email: "อีเมล",
                    terms: "เงื่อนไข",
                    holdMinutes: "เวลาชำระ (นาที)",
                    reviewHours: "ระยะตรวจสอบ (ชั่วโมง)",
                    correctionHours: "ระยะแก้หลักฐาน (ชั่วโมง)",
                    maxAdmissions: "สิทธิ์สูงสุดต่อการจอง",
                  } as Record<string, string>
                )[k] || k}
              </dt>
              <dd>{normalized}</dd>
            </div>
          );
        })}
    </dl>
  );
}
export function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <span className="muted">
        {total} รายการ · หน้า {page} / {pages}
      </span>
      <div className="actions">
        <button
          className="button button-outline"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          ก่อนหน้า
        </button>
        <button
          className="button button-outline"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}
