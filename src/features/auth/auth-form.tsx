"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { isStaff, rolesOf } from "@/lib/roles";
import { ErrorNotice, Field } from "@/components/ui";
export function AuthForm({ signup = false }: { signup?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  return (
    <div className="mongkol-page customer-page auth-page">
      <div className="auth-card customer-card">
        <div className="section-kicker" style={{ marginBottom: 10 }}>
          <span /> {signup ? "CREATE ACCOUNT" : "MEMBER ACCESS"}
        </div>
        <h1>{signup ? "เริ่มต้นคืนพิเศษของคุณ" : "ยินดีต้อนรับกลับ"}</h1>
        <p>
          {signup
            ? "สร้างบัญชีเพื่อจองและเก็บบัตรของคุณในที่เดียว"
            : "เข้าสู่ระบบเพื่อจองบัตรและดูการจองของคุณ"}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setPending(true);
            setError(null);
            try {
              const credentials = {
                email: String(form.get("email")),
                password: String(form.get("password")),
              };
              const result = signup
                ? await authClient.signUp.email({
                    ...credentials,
                    name: String(form.get("name")),
                  })
                : await authClient.signIn.email(credentials);
              if (result.error)
                throw new Error(
                  result.error.code === "INVALID_ORIGIN"
                    ? `ที่อยู่เว็บ ${window.location.origin} ไม่ตรงกับ BETTER_AUTH_URL ที่ตั้งไว้ในไฟล์ .env กรุณาเปิดเว็บจากที่อยู่นั้น หรือเพิ่มใน TRUSTED_ORIGINS`
                    : result.error.message || "เข้าสู่ระบบไม่สำเร็จ",
                );
              const next = new URLSearchParams(window.location.search).get(
                "next",
              );
              // Staff (owner and admins) land on the back office; customers on
              // their bookings.
              const home = isStaff(rolesOf(result.data))
                ? "/admin"
                : "/account/bookings";
              const destination = new URL(next || home, window.location.origin);
              window.location.assign(
                destination.origin === window.location.origin
                  ? destination.href
                  : new URL("/account/bookings", window.location.origin).href,
              );
            } catch (error) {
              setError(
                error instanceof Error ? error : new Error("ทำรายการไม่สำเร็จ"),
              );
            } finally {
              setPending(false);
            }
          }}
        >
          {signup ? (
            <Field label="ชื่อที่ใช้ในการจอง">
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
              />
            </Field>
          ) : null}
          <Field label="อีเมล">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </Field>
          <Field
            label="รหัสผ่าน"
            hint={signup ? "อย่างน้อย 12 ตัวอักษร" : undefined}
          >
            <input
              name="password"
              type="password"
              required
              minLength={signup ? 12 : 1}
              maxLength={128}
              autoComplete={signup ? "new-password" : "current-password"}
            />
          </Field>
          <ErrorNotice error={error} />
          <button
            className="mongkol-button button-wide"
            disabled={pending}
            type="submit"
          >
            {pending ? <LoaderCircle className="spinner" size={18} /> : null}
            {signup ? "สร้างบัญชี" : "เข้าสู่ระบบ"}
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="auth-switch">
          {signup ? "มีบัญชีแล้ว?" : "ยังไม่มีบัญชี?"}{" "}
          <Link className="text-link" href={signup ? "/login" : "/register"}>
            {signup ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </Link>
        </p>
        <p className="auth-note">
          หากไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลร้าน
          ขณะนี้ยังไม่เปิดบริการรีเซ็ตรหัสผ่านทางอีเมล
        </p>
      </div>
    </div>
  );
}
