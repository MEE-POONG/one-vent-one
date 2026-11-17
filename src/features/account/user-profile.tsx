"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Save,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useMutation, useResource } from "@/lib/client-api";
import { ErrorNotice, Field, Loading } from "@/components/ui";
import { BookingHistory } from "@/features/booking/booking-list";

type Profile = { id: string; name: string; email: string };

function ProfileSettings({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (profile: Profile) => void;
}) {
  const update = useMutation();
  const { refetch } = authClient.useSession();
  const [nameSaved, setNameSaved] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState<Error | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") || "").trim();
    setNameSaved(false);
    if (name.length < 2 || name.length > 80) {
      update.setError(new Error("กรุณากรอกชื่อ 2–80 ตัวอักษร"));
      return;
    }
    try {
      const saved = await update.run<Profile>("/api/me", { name }, "PATCH");
      onSave(saved);
      setNameSaved(true);
      void refetch();
    } catch {}
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const currentPassword = String(values.get("currentPassword") || "");
    const newPassword = String(values.get("newPassword") || "");
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword !== values.get("confirmPassword")) {
      setPasswordError(
        new Error("รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน กรุณากรอกอีกครั้ง"),
      );
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError(
        new Error("กรุณาเลือกรหัสผ่านใหม่ที่ต่างจากรหัสผ่านปัจจุบัน"),
      );
      return;
    }
    setPasswordPending(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        if (result.error.status === 429) {
          throw new Error("ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่");
        }
        const messages: Record<string, string> = {
          INVALID_PASSWORD:
            "รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่",
          PASSWORD_TOO_SHORT: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร",
          PASSWORD_TOO_LONG: "รหัสผ่านใหม่ต้องไม่เกิน 128 ตัวอักษร",
          SESSION_NOT_FRESH: "กรุณาเข้าสู่ระบบอีกครั้งก่อนเปลี่ยนรหัสผ่าน",
          UNAUTHORIZED: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
        };
        throw new Error(
          messages[result.error.code ?? ""] ??
            "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่หรือเข้าสู่ระบบอีกครั้ง",
        );
      }
      form.reset();
      setPasswordSaved(true);
      void refetch();
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error
          : new Error("เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่"),
      );
    } finally {
      setPasswordPending(false);
    }
  }

  return (
    <div className="profile-settings">
      <section
        id="profile-details"
        className="customer-card profile-settings-section"
        aria-labelledby="profile-details-title"
      >
        <h2 id="profile-details-title">ข้อมูลบัญชี</h2>
        <p className="muted">ชื่อที่แสดงในบัญชีและบัตรเข้างานของคุณ</p>
        <div className="profile-email">
          <span>อีเมลบัญชี</span>
          <p>{profile.email}</p>
        </div>
        <form className="profile-form" onSubmit={saveName}>
          <Field label="ชื่อที่ใช้ในการจอง">
            <input
              name="name"
              autoComplete="name"
              defaultValue={profile.name}
              required
              minLength={2}
              maxLength={80}
              disabled={update.pending}
              onChange={() => {
                setNameSaved(false);
                update.setError(null);
              }}
            />
          </Field>
          <ErrorNotice error={update.error} />
          {nameSaved ? (
            <p className="profile-success" role="status">
              <CheckCircle2 size={18} /> บันทึกชื่อเรียบร้อยแล้ว
            </p>
          ) : null}
          <button
            className="mongkol-button"
            type="submit"
            disabled={update.pending}
          >
            {update.pending ? (
              <LoaderCircle size={17} className="spinner" />
            ) : (
              <Save size={17} />
            )}
            {update.pending ? "กำลังบันทึก…" : "บันทึกชื่อ"}
          </button>
        </form>
      </section>

      <section
        id="profile-password"
        className="customer-card profile-settings-section"
        aria-labelledby="profile-password-title"
      >
        <h2 id="profile-password-title">เปลี่ยนรหัสผ่าน</h2>
        <p className="muted">ใช้รหัสผ่านปัจจุบันเพื่อยืนยันว่าเป็นคุณ</p>
        <form
          className="profile-form"
          onSubmit={changePassword}
          onChange={() => {
            setPasswordSaved(false);
            setPasswordError(null);
          }}
        >
          <Field label="รหัสผ่านปัจจุบัน">
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              disabled={passwordPending}
            />
          </Field>
          <Field
            label="รหัสผ่านใหม่"
            hint="อย่างน้อย 8 ตัวอักษร และไม่เกิน 128 ตัวอักษร"
          >
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              disabled={passwordPending}
            />
          </Field>
          <Field label="ยืนยันรหัสผ่านใหม่">
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              disabled={passwordPending}
            />
          </Field>
          <p className="profile-help">
            เมื่อเปลี่ยนสำเร็จ บัญชีของคุณจะออกจากระบบบนอุปกรณ์อื่น
          </p>
          <ErrorNotice error={passwordError} />
          {passwordSaved ? (
            <p className="profile-success" role="status">
              <CheckCircle2 size={18} /> เปลี่ยนรหัสผ่านเรียบร้อยแล้ว
            </p>
          ) : null}
          <button
            className="mongkol-button"
            type="submit"
            disabled={passwordPending}
          >
            {passwordPending ? (
              <LoaderCircle size={17} className="spinner" />
            ) : (
              <LockKeyhole size={17} />
            )}
            {passwordPending ? "กำลังเปลี่ยนรหัสผ่าน…" : "เปลี่ยนรหัสผ่าน"}
          </button>
        </form>
      </section>
    </div>
  );
}

export function UserProfile() {
  const resource = useResource<Profile>("/api/me");
  return (
    <div className="mongkol-page customer-page">
      <div className="mongkol-container section profile-page">
        <header className="profile-heading">
          <div>
            <h1>โปรไฟล์ของฉัน</h1>
            <p className="muted">จัดการข้อมูลบัญชี รหัสผ่าน และการจองของคุณ</p>
          </div>
          <nav className="profile-nav" aria-label="ส่วนต่าง ๆ ของโปรไฟล์">
            <a href="#profile-details">ข้อมูลบัญชี</a>
            <a href="#profile-password">รหัสผ่าน</a>
            <a href="#profile-bookings">การจองของฉัน</a>
          </nav>
        </header>
        <ErrorNotice error={resource.error} retry={resource.reload} />
        {resource.loading ? (
          <Loading />
        ) : resource.data ? (
          <>
            <ProfileSettings
              profile={resource.data}
              onSave={resource.setData}
            />
            <section
              id="profile-bookings"
              className="profile-bookings"
              aria-labelledby="profile-bookings-title"
            >
              <div className="profile-bookings-heading">
                <div>
                  <h2 id="profile-bookings-title">การจองของฉัน</h2>
                  <p className="muted">
                    ดูสถานะการจองและเปิดบัตรเข้างานได้ที่นี่
                  </p>
                </div>
                <Link className="view-all-button" href="/account/bookings">
                  ดูการจองทั้งหมด <ArrowRight size={16} />
                </Link>
              </div>
              <BookingHistory />
            </section>
          </>
        ) : (
          <Link className="mongkol-button" href="/login?next=%2Faccount">
            เข้าสู่ระบบอีกครั้ง
          </Link>
        )}
      </div>
    </div>
  );
}
