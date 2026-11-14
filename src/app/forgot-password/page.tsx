"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { useMutation } from "@/lib/client-api";
import { ErrorNotice, Field } from "@/components/ui";

type RequestStepResponse = {
  sent: boolean;
  email: string;
  userName: string;
  expiresAt: string;
  demoOtp?: string;
};

export default function ForgotPasswordPage() {
  const mutation = useMutation();
  const [step, setStep] = useState<"email" | "verify" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestInfo, setRequestInfo] = useState<RequestStepResponse | null>(
    null,
  );
  const [localError, setLocalError] = useState<Error | null>(null);

  return (
    <div className="mongkol-page customer-page auth-page">
      <div className="auth-card customer-card">
        <div className="section-kicker" style={{ marginBottom: 10 }}>
          <span /> PASSWORD RECOVERY
        </div>
        <h1>กู้คืนรหัสผ่าน</h1>
        <p>
          {step === "email"
            ? "กรอกอีเมลที่ใช้สมัครสมาชิกเพื่อรับรหัสยืนยัน 6 หลักสำหรับตั้งรหัสผ่านใหม่"
            : step === "verify"
              ? `กรอกรหัสยืนยัน 6 หลักที่ส่งไปยัง ${email} และตั้งรหัสผ่านใหม่ของคุณ`
              : "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว สามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที"}
        </p>

        {step === "email" ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLocalError(null);
              try {
                const res = await mutation.run<RequestStepResponse>(
                  "/api/password-recovery",
                  {
                    action: "request",
                    email: email.trim(),
                  },
                );
                setRequestInfo(res);
                if (res.demoOtp) {
                  setCode(res.demoOtp);
                }
                setStep("verify");
              } catch {}
            }}
          >
            <Field label="อีเมลที่ใช้สมัครสมาชิก">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>
            <ErrorNotice error={localError || mutation.error} />
            <button
              className="mongkol-button button-wide"
              disabled={mutation.pending}
              type="submit"
            >
              {mutation.pending ? (
                <LoaderCircle className="spinner" size={18} />
              ) : (
                <Mail size={18} />
              )}
              <span>ส่งรหัสกู้คืนรหัสผ่านไปที่อีเมล</span>
              <ArrowRight size={18} />
            </button>
          </form>
        ) : step === "verify" ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLocalError(null);
              if (newPassword !== confirmPassword) {
                setLocalError(
                  new Error("รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน"),
                );
                return;
              }
              try {
                await mutation.run("/api/password-recovery", {
                  action: "reset",
                  email: email.trim(),
                  code: code.trim(),
                  newPassword,
                });
                setStep("done");
              } catch {}
            }}
          >
            {requestInfo?.demoOtp ? (
              <div className="notice" style={{ marginBottom: 4 }}>
                <KeyRound size={18} style={{ color: "#fbbf24" }} />
                <div>
                  <strong style={{ color: "#ffffff", display: "block" }}>
                    ส่งรหัสกู้คืนไปยังอีเมลของ {requestInfo.userName} แล้ว
                  </strong>
                  <span>
                    รหัสยืนยัน 6 หลักสำหรับอีเมล <strong>{requestInfo.email}</strong>{" "}
                    คือ:{" "}
                    <code
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: "#09090e",
                        border: "1px solid #fbbf2466",
                        color: "#fbbf24",
                        fontWeight: 800,
                        letterSpacing: "0.1em",
                      }}
                    >
                      {requestInfo.demoOtp}
                    </code>{" "}
                    (มีอายุ 15 นาที)
                  </span>
                </div>
              </div>
            ) : null}

            <Field
              label="รหัสยืนยัน 6 หลักจากอีเมล"
              hint="ตัวเลข 6 หลักที่ได้รับทางอีเมล"
            >
              <input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D+/g, "").slice(0, 6))
                }
                required
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                style={{
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 18,
                  letterSpacing: "0.18em",
                  textAlign: "center",
                }}
              />
            </Field>

            <Field
              label="รหัสผ่านใหม่"
              hint="อย่างน้อย 8 ตัวอักษร และไม่เกิน 128 ตัวอักษร"
            >
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>

            <Field label="ยืนยันรหัสผ่านใหม่">
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>

            <ErrorNotice error={localError || mutation.error} />

            <button
              className="mongkol-button button-wide"
              disabled={mutation.pending}
              type="submit"
            >
              {mutation.pending ? (
                <LoaderCircle className="spinner" size={18} />
              ) : (
                <LockKeyhole size={18} />
              )}
              <span>ยืนยันและตั้งรหัสผ่านใหม่</span>
            </button>

            <button
              type="button"
              className="view-all-button button-wide"
              style={{ justifyContent: "center" }}
              disabled={mutation.pending}
              onClick={() => {
                mutation.setError(null);
                setLocalError(null);
                setStep("email");
              }}
            >
              <ArrowLeft size={16} />
              <span>เปลี่ยนอีเมล / ขอรหัสใหม่</span>
            </button>
          </form>
        ) : (
          <div className="stack-sm" style={{ marginTop: 18 }}>
            <div className="notice">
              <CheckCircle2 size={22} style={{ color: "#4ade80" }} />
              <div>
                <strong style={{ color: "#ffffff", display: "block" }}>
                  เปลี่ยนรหัสผ่านสำเร็จ!
                </strong>
                <p>
                  บัญชี <strong>{email}</strong> ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว
                  คุณสามารถใช้รหัสผ่านใหม่เข้าสู่ระบบได้ทันที
                </p>
              </div>
            </div>
            <Link href="/login" className="mongkol-button button-wide">
              <span>ไปหน้าเข้าสู่ระบบ</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        )}

        <p className="auth-switch">
          จำรหัสผ่านได้แล้ว?{" "}
          <Link className="text-link" href="/login">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}

