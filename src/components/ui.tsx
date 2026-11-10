"use client";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  LoaderCircle,
  MapPin,
  Ticket as TicketIcon,
} from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
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
export function EventRow({ event }: { event: EventData }) {
  return (
    <Highlight className="event-row">
      <Link
        className="event-image"
        href={`/events/${event.slug}`}
        aria-label={`ดู ${event.title}`}
      >
        <Image
          src={event.posterUrl || "/concert-hero.png"}
          alt=""
          width={300}
          height={332}
          sizes="(max-width: 520px) 90px, 150px"
          unoptimized={!!event.posterUrl?.startsWith("https:")}
        />
      </Link>
      <div className="event-row-content">
        <Status value={event.status} />
        <h3>
          <Link href={`/events/${event.slug}`}>{event.title}</Link>
        </h3>
        <p>
          <CalendarDays size={16} />
          {dateTime(event.startsAt)}
        </p>
        <p>
          <MapPin size={16} />
          {event.venue}
        </p>
      </div>
      <div className="event-row-action">
        {typeof event.minPriceSatang === "number" ? (
          <div>
            <span className="muted">เริ่มต้น</span>
            <strong>{money(event.minPriceSatang)}</strong>
          </div>
        ) : null}
        <Link href={`/events/${event.slug}`} className="button button-outline">
          รายละเอียด <ArrowRight size={18} />
        </Link>
      </div>
    </Highlight>
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
        .map(([k, v]) => (
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
            <dd>{String(v)}</dd>
          </div>
        ))}
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
