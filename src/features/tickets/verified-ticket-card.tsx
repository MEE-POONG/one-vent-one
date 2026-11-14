"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  Maximize2,
  Mic2,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useMutation, useResource } from "@/lib/client-api";
import type { VerifiedTicketInspection } from "@/lib/client-types";
import { isStaff as checkIsStaff, rolesOf } from "@/lib/roles";
import { dateTime, ErrorNotice, Loading } from "@/components/ui";

const CARD_VIRTUAL_WIDTH = 720;
const CARD_ASPECT_RATIO = 1.586;
const CARD_VIRTUAL_HEIGHT = Math.round(CARD_VIRTUAL_WIDTH / CARD_ASPECT_RATIO); // 454px (~ISO ID-1 credit-card proportion)

interface TicketCardFaceProps {
  data: VerifiedTicketInspection;
  flipped: boolean;
  onFlip: (next: boolean) => void;
  copied: boolean;
  onCopyCode: () => void;
  totalSeats: number;
  checkedInCount: number;
  remainingSeats: number;
  ticketCode: string;
  statusTone: "valid" | "used" | "invalid";
  qrValue: string;
  showStaffAction: boolean;
  isStaff: boolean;
  checkInPending: boolean;
  onStaffCheckIn: () => void;
}

function TicketCard3DFaces({
  data,
  flipped,
  onFlip,
  copied,
  onCopyCode,
  totalSeats,
  checkedInCount,
  remainingSeats,
  ticketCode,
  statusTone,
  qrValue,
  showStaffAction,
  isStaff,
  checkInPending,
  onStaffCheckIn,
}: TicketCardFaceProps) {
  return (
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
              onClick={() => onFlip(true)}
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
                  size={132}
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
                <div className="vticket-code-value-row">
                  <small className="vticket-code-label">
                    รหัสบัตร 8 หลัก (สำหรับเจ้าหน้าที่กรอก)
                  </small>
                  <button
                    type="button"
                    className="vticket-copy-btn"
                    onClick={onCopyCode}
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
                <div className="vticket-seat-progress-head">
                  <small>
                    <Users size={13} style={{ display: "inline", marginRight: 4 }} />
                    จำนวนครั้งที่ตรวจเข้างานของโต๊ะนี้
                  </small>
                  <strong
                    className={`vticket-seat-counter-badge ${remainingSeats === 0 ? "is-full" : ""}`}
                  >
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
              className="mongkol-button vticket-flip-btn"
              onClick={() => onFlip(false)}
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
                className="mongkol-button vticket-flip-btn vticket-staff-checkin-btn"
                disabled={checkInPending}
                onClick={onStaffCheckIn}
              >
                <CheckCircle2 size={16} />
                <span>
                  {checkInPending
                    ? "กำลังบันทึกเข้างาน..."
                    : `ยืนยันให้เข้างาน +1 ท่าน (ครั้งที่ ${checkedInCount + 1}/${totalSeats})`}
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}

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
  const [landscapeOpen, setLandscapeOpen] = useState(false);
  const [sceneWidth, setSceneWidth] = useState<number | null>(null);
  const [viewport, setViewport] = useState({ width: 390, height: 844 });
  const sceneRef = useRef<HTMLDivElement | null>(null);

  const { data: session } = authClient.useSession();
  const isStaff = checkIsStaff(rolesOf(session));
  const checkInMutation = useMutation();

  const totalSeats = Math.max(1, data.totalItemAdmissions || 1);
  const checkedInCount = data.checkedInCount ?? 0;
  const remainingSeats =
    data.remainingAdmissions ?? Math.max(0, totalSeats - checkedInCount);
  const ticketCode =
    data.ticketCode || data.verification.ticketCode || data.verification.verificationCode;

  const statusTone: "valid" | "used" | "invalid" =
    data.status === "ACTIVE" && data.valid && remainingSeats > 0
      ? "valid"
      : data.status === "USED" || remainingSeats === 0
        ? "used"
        : "invalid";

  const qrValue =
    typeof window !== "undefined"
      ? `${window.location.origin}/tickets/verify/${encodeURIComponent(data.token)}`
      : `/tickets/verify/${encodeURIComponent(data.token)}`;

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const measure = () => setSceneWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!landscapeOpen) return;
    const syncViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    syncViewport();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLandscapeOpen(false);
    };
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [landscapeOpen]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(ticketCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard permission errors
    }
  }

  async function handleStaffCheckIn() {
    try {
      await checkInMutation.run("/api/check-in", {
        eventId: data.event.id,
        token: ticketCode,
      });
      onCheckInSuccess?.();
    } catch {}
  }

  // Keep true 1.586:1 credit-card proportions at any viewport width by scaling a 720x454 virtual pass below 720px.
  const isScaled = sceneWidth !== null && sceneWidth > 0 && sceneWidth < CARD_VIRTUAL_WIDTH;
  const inlineScale = isScaled ? sceneWidth / CARD_VIRTUAL_WIDTH : 1;
  const scaledHeight = isScaled ? Math.round(sceneWidth / CARD_ASPECT_RATIO) : undefined;

  // In full-screen pass mode, auto-rotate 90deg on portrait phones so the horizontal card aligns with the long screen edge.
  const isPortraitViewport = viewport.width < viewport.height;
  const chromeReserved = viewport.width < 430 ? 116 : 108;
  const availW = Math.max(220, viewport.width - 28);
  const availH = Math.max(180, viewport.height - chromeReserved);
  const overlayScale = isPortraitViewport
    ? Math.min(1.25, availW / CARD_VIRTUAL_HEIGHT, availH / CARD_VIRTUAL_WIDTH)
    : Math.min(1.3, availW / CARD_VIRTUAL_WIDTH, availH / CARD_VIRTUAL_HEIGHT);
  const overlayVisualW = Math.round(
    (isPortraitViewport ? CARD_VIRTUAL_HEIGHT : CARD_VIRTUAL_WIDTH) * overlayScale,
  );
  const overlayVisualH = Math.round(
    (isPortraitViewport ? CARD_VIRTUAL_WIDTH : CARD_VIRTUAL_HEIGHT) * overlayScale,
  );

  const sharedFaceProps: TicketCardFaceProps = {
    data,
    flipped,
    onFlip: setFlipped,
    copied,
    onCopyCode: copyCode,
    totalSeats,
    checkedInCount,
    remainingSeats,
    ticketCode,
    statusTone,
    qrValue,
    showStaffAction,
    isStaff,
    checkInPending: checkInMutation.pending,
    onStaffCheckIn: handleStaffCheckIn,
  };

  return (
    <div className="vticket-wrapper">
      <div className="vticket-mode-bar">
        <button
          type="button"
          className="vticket-landscape-trigger"
          onClick={() => setLandscapeOpen(true)}
        >
          <Maximize2 size={15} />
          <span>ดูบัตรแบบเต็มจอ</span>
        </button>
      </div>

      <div
        ref={sceneRef}
        className={`vticket-scene ${flipped ? "is-flipped" : ""}`}
        style={scaledHeight ? { height: `${scaledHeight}px` } : undefined}
      >
        <div
          className={`vticket-scale-stage ${isScaled ? "is-scaled" : ""}`}
          style={
            isScaled
              ? {
                  width: `${CARD_VIRTUAL_WIDTH}px`,
                  height: `${CARD_VIRTUAL_HEIGHT}px`,
                  transform: `scale(${inlineScale})`,
                }
              : undefined
          }
        >
          <TicketCard3DFaces {...sharedFaceProps} />
        </div>
      </div>

      <ErrorNotice error={checkInMutation.error} />

      {landscapeOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="vticket-landscape-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="แสดงบัตรประจำโต๊ะแบบเต็มจอ"
              onClick={() => setLandscapeOpen(false)}
            >
              <div className="vticket-landscape-topbar">
                <button
                  type="button"
                  className="vticket-landscape-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLandscapeOpen(false);
                  }}
                  aria-label="ปิดมุมมองบัตรแบบเต็มจอ"
                >
                  <X size={18} />
                  <span>ปิด</span>
                </button>
              </div>

              <div className="vticket-landscape-body">
                <div
                  className="vticket-landscape-stage"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: `${overlayVisualW}px`,
                    height: `${overlayVisualH}px`,
                  }}
                >
                  <div
                    className={`vticket-landscape-rotator vticket-scene ${flipped ? "is-flipped" : ""}`}
                    style={{
                      width: `${CARD_VIRTUAL_WIDTH}px`,
                      height: `${CARD_VIRTUAL_HEIGHT}px`,
                      marginLeft: `${-CARD_VIRTUAL_WIDTH / 2}px`,
                      marginTop: `${-CARD_VIRTUAL_HEIGHT / 2}px`,
                      transform: `${isPortraitViewport ? "rotate(90deg) " : ""}scale(${overlayScale})`,
                    }}
                  >
                    <TicketCard3DFaces {...sharedFaceProps} />
                  </div>
                </div>
                <p className="vticket-landscape-hint">
                  {isPortraitViewport
                    ? "บัตรแสดงผลแนวนอนสัดส่วน 1.586:1 · แตะพื้นที่รอบบัตรหรือกด X เพื่อปิด"
                    : "บัตรแสดงผลเต็มจอสัดส่วน 1.586:1 · คลิกพื้นที่รอบบัตร กด Esc หรือกด X เพื่อปิด"}
                </p>
                <div onClick={(e) => e.stopPropagation()}>
                  <ErrorNotice error={checkInMutation.error} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
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
