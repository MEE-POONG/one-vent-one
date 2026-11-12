"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Cpu,
  Fingerprint,
  Lock,
  MapPin,
  Mic2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserCheck,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useMutation, useResource } from "@/lib/client-api";
import type { VerifiedTicketInspection } from "@/lib/client-types";
import { isStaff as checkIsStaff, rolesOf } from "@/lib/roles";
import { dateTime, ErrorNotice, Loading, modeText, money } from "@/components/ui";

export function VerifiedTicketFlipCard({
  data,
  onCheckInSuccess,
  showStaffAction = true,
}: {
  data: VerifiedTicketInspection;
  onCheckInSuccess?: () => void;
  showStaffAction?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const { data: session } = authClient.useSession();
  const isStaff = checkIsStaff(rolesOf(session));
  const checkInMutation = useMutation();

  const statusTone =
    data.status === "ACTIVE" && data.valid
      ? "valid"
      : data.status === "USED"
        ? "used"
        : "invalid";

  return (
    <div className="vticket-wrapper">
      <div className="vticket-mode-bar">
        <div className="vticket-side-indicator">
          <span className={`vticket-side-pill ${!flipped ? "active" : ""}`}>
            <Ticket size={14} /> หน้าบัตร (ข้อมูลทั่วไป)
          </span>
          <span className={`vticket-side-pill ${flipped ? "active" : ""}`}>
            <ShieldCheck size={14} /> หลังบัตร (ตรวจสอบบัตรจริง)
          </span>
        </div>
        <button
          type="button"
          className="vticket-flip-trigger"
          onClick={() => setFlipped((prev) => !prev)}
          aria-pressed={flipped}
        >
          {flipped ? (
            <>
              <RotateCcw size={16} />
              <span>พลิกกลับหน้าบัตร</span>
            </>
          ) : (
            <>
              <RotateCw size={16} />
              <span>พลิกดูหลังบัตร</span>
            </>
          )}
        </button>
      </div>

      <div className={`vticket-scene ${flipped ? "is-flipped" : ""}`}>
        <div className="vticket-card-3d">
          {/* FRONT OF TICKET: General Event & Seat Information */}
          <article
            className={`vticket-face vticket-front status-${statusTone}`}
            aria-hidden={flipped}
          >
            <div className={`vticket-status-banner status-${statusTone}`}>
              {statusTone === "valid" ? (
                <>
                  <ShieldCheck size={22} />
                  <div>
                    <strong>VERIFIED PASS · บัตรของแท้พร้อมเข้างาน</strong>
                    <small>
                      ตรวจสอบกับฐานข้อมูลสำเร็จ สามารถใช้เข้างานได้ 1 ท่าน
                    </small>
                  </div>
                </>
              ) : statusTone === "used" ? (
                <>
                  <AlertTriangle size={22} />
                  <div>
                    <strong>ALREADY CHECKED IN · บัตรนี้ใช้เข้างานแล้ว</strong>
                    <small>
                      สแกนเข้างานเมื่อ{" "}
                      {data.verification.usedAt
                        ? dateTime(data.verification.usedAt)
                        : "ก่อนหน้านี้"}{" "}
                      (ห้ามใช้ภาพแคปหน้าจอซ้ำ)
                    </small>
                  </div>
                </>
              ) : (
                <>
                  <ShieldAlert size={22} />
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
                    <span /> OFFICIAL E-TICKET PASS
                  </div>
                  <div className="vticket-chip" aria-hidden="true" />
                </div>
                <h2>{data.event.title}</h2>
                <div className="vticket-event-meta">
                  {data.event.artists?.length ? (
                    <span className="vticket-artists">
                      <Mic2 size={14} />
                      {data.event.artists.join(" · ")}
                    </span>
                  ) : null}
                  <span>
                    <CalendarDays size={14} />
                    {dateTime(data.event.startsAt)}
                  </span>
                  <span>
                    <MapPin size={14} />
                    {data.event.venue}
                  </span>
                </div>
              </div>

              <div className="vticket-info-grid">
                <div className="vticket-info-box highlight">
                  <small>โต๊ะ / ที่นั่ง / ประเภทบัตร</small>
                  <strong>{data.itemLabel}</strong>
                  <span>{modeText(data.sellingMode)}</span>
                </div>
                <div className="vticket-info-box highlight">
                  <small>โซน (ZONE)</small>
                  <strong>{data.zoneName}</strong>
                  <span>
                    ลำดับบัตรใบที่ {data.admissionSequence} /{" "}
                    {data.totalItemAdmissions}
                  </span>
                </div>
                <div className="vticket-info-box">
                  <small>เลขที่ใบจอง (BOOKING NO.)</small>
                  <strong>{data.booking.bookingNumber}</strong>
                  <span>รวมทั้งใบจอง {data.booking.totalAdmissions} สิทธิ์</span>
                </div>
                <div className="vticket-info-box">
                  <small>ผู้ถือบัตร / รูปแบบการจอง</small>
                  <strong>{data.holderName}</strong>
                  <span>
                    {data.isGuestBooking
                      ? "จองแบบไม่ต้องล็อกอิน (Guest)"
                      : "สมาชิก (Registered Member)"}
                  </span>
                </div>
              </div>

              <div className="vticket-front-footer">
                <div className="vticket-seal-Preview">
                  <Fingerprint size={17} />
                  <span>{data.verification.verificationCode}</span>
                </div>
                <button
                  type="button"
                  className="mongkol-button vticket-flip-btn"
                  onClick={() => setFlipped(true)}
                >
                  <RotateCw size={16} />
                  <span>พลิกดูหลังบัตรเพื่อตรวจสอบบัตรจริง</span>
                </button>
              </div>
            </div>
          </article>

          {/* BACK OF TICKET: Cryptographic & Anti-Fraud Verification Details */}
          <article
            className={`vticket-face vticket-back status-${statusTone}`}
            aria-hidden={!flipped}
          >
            <div className="vticket-hologram-strip">
              <div className="vticket-live-dot" />
              <Sparkles size={16} />
              <span>
                ONEVENTONE SECURITY SEAL · ตรวจสอบสดเมื่อ{" "}
                {dateTime(data.verification.serverVerifiedAt)}
              </span>
            </div>

            <div className="vticket-back-body">
              <div className="vticket-back-head">
                <div>
                  <div className="section-kicker" style={{ marginBottom: 6 }}>
                    <span /> BACK OF TICKET · AUTHENTICITY PROOF
                  </div>
                  <h3>ข้อมูลยืนยันความถูกต้องของบัตรจริง</h3>
                  <p>
                    ข้อมูลชุดนี้ดึงจากฐานข้อมูลเข้ารหัสของร้านโดยตรง
                    ใช้สำหรับตรวจสอบว่าเป็นบัตรที่ชำระเงินและออกโดยระบบจริง
                  </p>
                </div>
              </div>

              <div className="vticket-security-checklist">
                <div className="vticket-security-item">
                  <div className="vticket-security-icon">
                    <Fingerprint size={19} />
                  </div>
                  <div>
                    <small>1. ลายนิ้วมือดิจิทัล & รหัสรับรองบัตร (SHA-256 Digest)</small>
                    <strong>{data.verification.verificationCode}</strong>
                    <code>SHA-256: {data.verification.sha256Fingerprint}</code>
                  </div>
                </div>

                <div className="vticket-security-item">
                  <div className="vticket-security-icon">
                    <Lock size={19} />
                  </div>
                  <div>
                    <small>2. หลักฐานการชำระเงินและการอนุมัติในระบบ</small>
                    <strong>
                      สถานะใบจอง: {data.booking.status} · ยอดรวม{" "}
                      {money(data.booking.totalSatang)}
                    </strong>
                    <span>
                      ชำระผ่าน: {data.booking.paymentMethod} · ยืนยันเมื่อ{" "}
                      {data.booking.confirmedAt
                        ? dateTime(data.booking.confirmedAt)
                        : dateTime(data.verification.issuedAt)}
                    </span>
                  </div>
                </div>

                <div className="vticket-security-item">
                  <div className="vticket-security-icon">
                    <UserCheck size={19} />
                  </div>
                  <div>
                    <small>
                      3. การป้องกันการใช้ภาพแคปหน้าจอซ้ำ (Anti-Passback Check)
                    </small>
                    {data.status === "ACTIVE" ? (
                      <>
                        <strong className="text-valid">
                          ยังไม่เคยถูกสแกนเข้างาน (พร้อมใช้เข้างานได้ 1 ท่าน)
                        </strong>
                        <span>
                          จำนวนครั้งที่สแกนบันทึกเข้างาน:{" "}
                          {data.verification.checkInAttempts} ครั้ง
                        </span>
                      </>
                    ) : data.status === "USED" ? (
                      <>
                        <strong className="text-used">
                          ถูกสแกนใช้เข้างานไปแล้วเมื่อ{" "}
                          {data.verification.usedAt
                            ? dateTime(data.verification.usedAt)
                            : "-"}
                        </strong>
                        <span>
                          ผู้ตรวจบัตร:{" "}
                          {data.verification.usedByStaff || "เจ้าหน้าที่หน้างาน"} ·
                          ห้ามอนุญาตให้ใช้ภาพแคปหน้าจอนี้ซ้ำ
                        </span>
                      </>
                    ) : (
                      <>
                        <strong className="text-invalid">
                          บัตรถูกยกเลิกแล้ว ไม่สามารถใช้เข้างานได้
                        </strong>
                        <span>
                          ยกเลิกเมื่อ:{" "}
                          {data.verification.revokedAt
                            ? dateTime(data.verification.revokedAt)
                            : "-"}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="vticket-security-item">
                  <div className="vticket-security-icon">
                    <Cpu size={19} />
                  </div>
                  <div>
                    <small>4. ข้อมูลอ้างอิงทางเทคนิค (System Metadata)</small>
                    <strong>Ticket ID: {data.ticketId}</strong>
                    <span>
                      มาตรฐาน: {data.verification.encryptionSuite} · ผังงาน:{" "}
                      {data.verification.layoutVersionId.slice(-8).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="vticket-back-footer">
                <button
                  type="button"
                  className="view-all-button"
                  onClick={() => setFlipped(false)}
                >
                  <RotateCcw size={17} />
                  <span>พลิกกลับไปหน้าบัตร</span>
                </button>

                {showStaffAction && isStaff && data.status === "ACTIVE" && data.valid ? (
                  <button
                    type="button"
                    className="mongkol-button"
                    disabled={checkInMutation.pending}
                    onClick={async () => {
                      try {
                        await checkInMutation.run("/api/check-in", {
                          eventId: data.event.id,
                          token: data.token,
                        });
                        onCheckInSuccess?.();
                      } catch {}
                    }}
                  >
                    <CheckCircle2 size={17} />
                    <span>
                      {checkInMutation.pending
                        ? "กำลังบันทึกเข้างาน..."
                        : "ยืนยันให้เข้างาน (สำหรับเจ้าหน้าที่)"}
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

  return (
    <div className="mongkol-page customer-page">
      <div className="mongkol-container section">
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
            <span>ตรวจสอบสถานะล่าสุด</span>
          </button>
        </div>

        <div style={{ marginTop: 26, marginBottom: 24 }}>
          <div className="section-kicker" style={{ marginBottom: 8 }}>
            <span /> QR SCANNER VERIFICATION RESULT
          </div>
          <h1>ผลการสแกนตรวจสอบบัตรเข้างาน</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            แสดงข้อมูลทั่วไปบนหน้าบัตร และสามารถกดพลิกดูหลังบัตรเพื่อตรวจสอบความถูกต้องของบัตรจริงได้
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
