"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  MapPin,
  Mic2,
  QrCode,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useMutation, useResource } from "@/lib/client-api";
import type { VerifiedTicketInspection } from "@/lib/client-types";
import { isStaff as checkIsStaff, rolesOf } from "@/lib/roles";
import { dateTime, ErrorNotice, Loading } from "@/components/ui";

export function VerifiedTicketFlipCard({
  data,
  onCheckInSuccess,
  showStaffAction = true,
  defaultFlipped = false,
}: {
  data: VerifiedTicketInspection;
  onCheckInSuccess?: () => void;
  showStaffAction?: boolean;
  defaultFlipped?: boolean;
}) {
  const [flipped, setFlipped] = useState(defaultFlipped);
  const [copied, setCopied] = useState(false);
  const { data: session } = authClient.useSession();
  const isStaff = checkIsStaff(rolesOf(session));
  const checkInMutation = useMutation();

  const totalSeats = Math.max(1, data.totalItemAdmissions || 1);
  const checkedInCount = data.checkedInCount ?? 0;
  const remainingSeats =
    data.remainingAdmissions ?? Math.max(0, totalSeats - checkedInCount);
  const ticketCode =
    data.ticketCode || data.verification.ticketCode || data.verification.verificationCode;

  const statusTone =
    data.status === "ACTIVE" && data.valid && remainingSeats > 0
      ? "valid"
      : data.status === "USED" || remainingSeats === 0
        ? "used"
        : "invalid";

  const qrValue =
    typeof window !== "undefined"
      ? `${window.location.origin}/tickets/verify/${encodeURIComponent(data.token)}`
      : `/tickets/verify/${encodeURIComponent(data.token)}`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(ticketCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard permission errors
    }
  }

  return (
    <div className="vticket-wrapper">
      <div className="vticket-mode-bar">
        <div className="vticket-side-indicator">
          <button
            type="button"
            className={`vticket-side-pill ${!flipped ? "active" : ""}`}
            onClick={() => setFlipped(false)}
          >
            <Ticket size={14} /> หน้าบัตร (ข้อมูลโต๊ะ)
          </button>
          <button
            type="button"
            className={`vticket-side-pill ${flipped ? "active" : ""}`}
            onClick={() => setFlipped(true)}
          >
            <QrCode size={14} /> หลังบัตร (QR Code & รหัส 8 หลัก)
          </button>
        </div>
        <button
          type="button"
          className="vticket-flip-trigger"
          onClick={() => setFlipped((prev) => !prev)}
          aria-pressed={flipped}
        >
          {flipped ? (
            <>
              <RotateCcw size={15} />
              <span>พลิกดูหน้าบัตร</span>
            </>
          ) : (
            <>
              <RotateCw size={15} />
              <span>พลิกหลังบัตร (QR / รหัส)</span>
            </>
          )}
        </button>
      </div>

      <div className={`vticket-scene ${flipped ? "is-flipped" : ""}`}>
        <div className="vticket-card-3d">
          {/* FRONT OF TICKET: Table Pass & Event Overview */}
          <article
            className={`vticket-face vticket-front status-${statusTone}`}
            aria-hidden={flipped}
          >
            <div className={`vticket-status-banner status-${statusTone}`}>
              {statusTone === "valid" ? (
                <>
                  <ShieldCheck size={20} />
                  <div>
                    <strong>
                      {checkedInCount === 0
                        ? `TABLE PASS · บัตรประจำโต๊ะ (${totalSeats} ที่นั่ง)`
                        : `ACTIVE TABLE PASS · เช็กอินแล้ว ${checkedInCount} / ${totalSeats} ที่นั่ง`}
                    </strong>
                    <small>
                      {checkedInCount === 0
                        ? `ยังไม่เช็กอิน · แคปหน้าจอบัตรนี้ส่งให้เพื่อนร่วมโต๊ะ (ใช้เข้างานได้รวม ${totalSeats} ครั้ง)`
                        : `ยังใช้เข้างานต่อได้อีก ${remainingSeats} ท่าน · พลิกหลังบัตรเพื่อแสดง QR Code หรือรหัส 8 หลัก`}
                    </small>
                  </div>
                </>
              ) : statusTone === "used" ? (
                <>
                  <AlertTriangle size={20} />
                  <div>
                    <strong>
                      ALL SEATS CHECKED IN · โต๊ะนี้เข้างานครบทั้ง {totalSeats} ที่นั่งแล้ว
                    </strong>
                    <small>
                      เช็กอินครบ {checkedInCount} / {totalSeats} ท่าน ล่าสุดเมื่อ{" "}
                      {data.verification.usedAt
                        ? dateTime(data.verification.usedAt)
                        : "ก่อนหน้านี้"}
                    </small>
                  </div>
                </>
              ) : (
                <>
                  <ShieldAlert size={20} />
                  <div>
                    <strong>INVALID / REVOKED · บัตรนี้ไม่สามารถใช้งานได้</strong>
                    <small>
                      สถานะบัตร: {data.status} · สถานะใบจอง:{" "}
                      {data.booking.status}
                    </small>
                  </div>
                </>
              )}
            </div>

            <div className="vticket-front-body">
              <div className="vticket-event-header">
                <div className="vticket-card-chip-row">
                  <div className="section-kicker" style={{ marginBottom: 0 }}>
                    <span /> OFFICIAL TABLE PASS · 1 TABLE = 1 TICKET
                  </div>
                  <div className="vticket-chip" aria-hidden="true" />
                </div>
                <h2>{data.event.title}</h2>
                <div className="vticket-event-meta">
                  {data.event.artists?.length ? (
                    <span className="vticket-artists">
                      <Mic2 size={13} />
                      {data.event.artists.join(" · ")}
                    </span>
                  ) : null}
                  <span>
                    <CalendarDays size={13} />
                    {dateTime(data.event.startsAt)}
                  </span>
                  <span>
                    <MapPin size={13} />
                    {data.event.venue}
                  </span>
                </div>
              </div>

              <div className="vticket-info-grid">
                <div className="vticket-info-box highlight">
                  <small>โต๊ะที่จอง (TABLE)</small>
                  <strong>{data.itemLabel}</strong>
                  <span>1 บัตรใช้ร่วมกันทั้งโต๊ะ</span>
                </div>
                <div className="vticket-info-box highlight">
                  <small>สิทธิ์เข้างานของโต๊ะ (SEATS)</small>
                  <strong>
                    เข้าแล้ว {checkedInCount} / {totalSeats} ที่นั่ง
                  </strong>
                  <span>คงเหลือเข้างานได้อีก {remainingSeats} ท่าน</span>
                </div>
                <div className="vticket-info-box">
                  <small>รหัสบัตร 8 หลัก (PASS CODE)</small>
                  <strong className="vticket-mono-code">{ticketCode}</strong>
                  <span>ใบจอง {data.booking.bookingNumber}</span>
                </div>
                <div className="vticket-info-box">
                  <small>ชื่อผู้จองโต๊ะ (HOLDER)</small>
                  <strong>{data.holderName}</strong>
                  <span>แคปหน้าจอส่งให้เพื่อนในโต๊ะได้</span>
                </div>
              </div>

              <div className="vticket-front-footer">
                <div className="vticket-seal-Preview">
                  <KeyRound size={15} />
                  <span>รหัสตรวจเข้างาน: {ticketCode}</span>
                </div>
                <button
                  type="button"
                  className="mongkol-button vticket-flip-btn"
                  onClick={() => setFlipped(true)}
                >
                  <QrCode size={16} />
                  <span>พลิกดูหลังบัตร (QR Code & รหัส 8 หลัก)</span>
                </button>
              </div>
            </div>
          </article>

          {/* BACK OF TICKET: QR Code, 8-Character Code & Seat Check-in Counter */}
          <article
            className={`vticket-face vticket-back status-${statusTone}`}
            aria-hidden={!flipped}
          >
            <div className="vticket-hologram-strip">
              <div className="vticket-live-dot" />
              <Sparkles size={15} />
              <span>
                STAFF CHECK-IN PASS · โต๊ะ {data.itemLabel} · เช็กอินแล้ว{" "}
                {checkedInCount}/{totalSeats} ที่นั่ง
              </span>
            </div>

            <div className="vticket-back-body">
              <div className="vticket-back-pass-grid">
                <div className="vticket-qr-panel">
                  <div className="vticket-qr-frame">
                    <QRCodeSVG
                      value={qrValue}
                      size={140}
                      marginSize={2}
                      level="M"
                      title={`QR Code เข้างาน โต๊ะ ${data.itemLabel} (${ticketCode})`}
                    />
                  </div>
                  <span className="vticket-qr-caption">
                    สแกน QR Code เพื่อเช็กอินทีละ 1 ท่าน
                  </span>
                </div>

                <div className="vticket-code-panel">
                  <div className="vticket-code-box">
                    <div className="between" style={{ gap: 8 }}>
                      <small>รหัสบัตร 8 หลัก (สำหรับเจ้าหน้าที่กรอก)</small>
                      <button
                        type="button"
                        className="vticket-copy-btn"
                        onClick={copyCode}
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                      </button>
                    </div>
                    <div className="vticket-code-digits">{ticketCode}</div>
                    <div className="vticket-code-hint">
                      <span>{ticketCode.slice(0, 2)} (ตัวอักษร)</span>
                      <span>·</span>
                      <span>{ticketCode.slice(2, 5)} (เลขโต๊ะ)</span>
                      <span>·</span>
                      <span>{ticketCode.slice(5, 8)} (รหัสสุ่ม)</span>
                    </div>
                  </div>

                  <div className="vticket-seat-progress-box">
                    <div className="between" style={{ gap: 8, flexWrap: "wrap" }}>
                      <small>
                        <Users size={13} style={{ display: "inline", marginRight: 4 }} />
                        จำนวนครั้งที่ตรวจเข้างานของโต๊ะนี้
                      </small>
                      <strong className="vticket-seat-counter-badge">
                        {checkedInCount} / {totalSeats} ที่นั่ง
                      </strong>
                    </div>
                    <div className="vticket-seat-pills">
                      {Array.from({ length: totalSeats }, (_, idx) => {
                        const entered = idx < checkedInCount;
                        return (
                          <span
                            key={idx}
                            className={`vticket-seat-pill ${entered ? "is-entered" : ""}`}
                          >
                            {entered ? "✓" : idx + 1} ท่านที่ {idx + 1}
                          </span>
                        );
                      })}
                    </div>
                    <p className="vticket-share-hint">
                      มาด้วยกัน {totalSeats} ท่าน ใช้บัตรใบเดียวนี้ร่วมกันได้โดยแคปหน้าจอส่งให้เพื่อน
                      เจ้าหน้าที่สแกน QR หรือกรอกรหัส <strong>{ticketCode}</strong> ยืนยัน 1 ครั้งต่อ 1 ท่าน จนครบ {totalSeats} ครั้ง
                    </p>
                  </div>
                </div>
              </div>

              <div className="vticket-back-footer">
                <button
                  type="button"
                  className="view-all-button vticket-flip-btn"
                  onClick={() => setFlipped(false)}
                >
                  <RotateCcw size={16} />
                  <span>พลิกกลับหน้าบัตร</span>
                </button>

                {showStaffAction &&
                isStaff &&
                data.status === "ACTIVE" &&
                data.valid &&
                remainingSeats > 0 ? (
                  <button
                    type="button"
                    className="mongkol-button vticket-flip-btn"
                    disabled={checkInMutation.pending}
                    onClick={async () => {
                      try {
                        await checkInMutation.run("/api/check-in", {
                          eventId: data.event.id,
                          token: ticketCode,
                        });
                        onCheckInSuccess?.();
                      } catch {}
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>
                      {checkInMutation.pending
                        ? "กำลังบันทึกเข้างาน..."
                        : `ยืนยันให้เข้างาน +1 ท่าน (ครั้งที่ ${checkedInCount + 1}/${totalSeats})`}
                    </span>
                  </button>
                ) : null}
              </div>
              <ErrorNotice error={checkInMutation.error} />
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

export function TicketVerificationView({ token }: { token: string }) {
  const resource = useResource<VerifiedTicketInspection>(
    `/api/tickets/verify/${encodeURIComponent(token)}`,
  );

  const posterUrl = resource.data?.event?.posterUrl || "/concert-hero.png";

  return (
    <div className="mongkol-page customer-page event-detail-page">
      <div className="event-detail-backdrop" aria-hidden="true">
        <Image
          src={posterUrl}
          alt=""
          fill
          sizes="100vw"
          unoptimized={posterUrl.startsWith("https:")}
        />
      </div>
      <div className="mongkol-container section event-detail-content">
        <div className="between" style={{ flexWrap: "wrap", gap: 12 }}>
          <Link href="/events" className="view-all-button customer-back-link">
            <ArrowLeft size={17} />
            <span>ไปหน้าอีเวนต์ทั้งหมด</span>
          </Link>
          <button
            type="button"
            className="view-all-button"
            onClick={resource.reload}
          >
            <RefreshCw size={16} />
            <span>อัปเดตสถานะเช็กอิน</span>
          </button>
        </div>

        <div style={{ marginTop: 22, marginBottom: 20 }}>
          <div className="section-kicker" style={{ marginBottom: 8 }}>
            <span /> TABLE ENTRY PASS
          </div>
          <h1>บัตรประจำโต๊ะสำหรับเข้างาน</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            1 โต๊ะใช้บัตรใบเดียวร่วมกันได้ทุกที่นั่ง · พลิกด้านหลังบัตรเพื่อแสดง QR Code หรือรหัสบัตร 8 หลักให้เจ้าหน้าที่ตรวจเข้างาน
          </p>
        </div>

        <ErrorNotice error={resource.error} retry={resource.reload} />
        {resource.loading ? (
          <Loading />
        ) : resource.data ? (
          <VerifiedTicketFlipCard
            data={resource.data}
            onCheckInSuccess={resource.reload}
          />
        ) : null}
      </div>
    </div>
  );
}
