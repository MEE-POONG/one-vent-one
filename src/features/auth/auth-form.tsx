"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { authDestination } from "@/lib/auth-redirect";
import { isStaff, rolesOf } from "@/lib/roles";
import { ErrorNotice, Field } from "@/components/ui";
export function AuthForm({
  signup = false,
  returnTo,
  googleEnabled = false,
  oauthError,
}: {
  signup?: boolean;
  returnTo?: string;
  googleEnabled?: boolean;
  oauthError?: string;
}) {
  const [pending, setPending] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<Error | null>(() =>
    oauthError
      ? new Error(
          oauthError === "access_denied"
            ? "คุณยกเลิกการเข้าสู่ระบบด้วย Google สามารถลองใหม่ได้"
            : oauthError === "account_not_linked"
              ? "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่านเดิม"
              : "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง หรือเข้าสู่ระบบด้วยอีเมล",
        )
      : null,
  );
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
        <ErrorNotice error={error} />
        <button
          className="google-sign-in button-wide"
          type="button"
          disabled={Boolean(pending) || !googleEnabled}
          aria-describedby={!googleEnabled ? "google-sign-in-note" : undefined}
          onClick={async () => {
            setPending("google");
            setError(null);
            try {
              const callback = new URL(
                "/auth/complete",
                window.location.origin,
              );
              const errorCallback = new URL(
                signup ? "/register" : "/login",
                window.location.origin,
              );
              if (returnTo) {
                const destination = authDestination(returnTo);
                callback.searchParams.set("next", destination);
                errorCallback.searchParams.set("next", destination);
              }
              const result = await authClient.signIn.social({
                provider: "google",
                callbackURL: callback.href,
                errorCallbackURL: errorCallback.href,
              });
              if (result.error)
                throw new Error(
                  "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง",
                );
              // Keep both sign-in actions disabled while the browser redirects.
            } catch (error) {
              setError(
                error instanceof Error ? error : new Error("ทำรายการไม่สำเร็จ"),
              );
              setPending(null);
            }
          }}
        >
          {pending === "google" ? (
            <LoaderCircle className="spinner" size={20} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.35-2.59Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.88-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59C7.19 7.72 9.4 5.96 12 5.96Z"
              />
            </svg>
          )}
          {pending === "google"
            ? "กำลังไปยัง Google…"
            : "เข้าสู่ระบบด้วย Google"}
        </button>
        {!googleEnabled ? (
          <div id="google-sign-in-note" className="auth-provider-note">
            การเข้าสู่ระบบด้วย Google ยังไม่เปิดให้บริการ
          </div>
        ) : null}
        <div className="auth-divider">
          <span>หรือใช้อีเมล</span>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setPending("email");
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
              // Staff (owner and admins) land on the back office; customers on
              // their bookings.
              const home = isStaff(rolesOf(result.data))
                ? "/admin"
                : "/account/bookings";
              window.location.assign(authDestination(returnTo, home));
            } catch (error) {
              setError(
                error instanceof Error ? error : new Error("ทำรายการไม่สำเร็จ"),
              );
            } finally {
              setPending(null);
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
            hint={signup ? "อย่างน้อย 8 ตัวอักษร" : undefined}
          >
            <input
              name="password"
              type="password"
              required
              minLength={signup ? 8 : 1}
              maxLength={128}
              autoComplete={signup ? "new-password" : "current-password"}
            />
          </Field>
          {!signup ? (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: -8,
              }}
            >
              <Link
                className="text-link"
                href="/forgot-password"
                style={{ fontSize: 13 }}
              >
                ลืมรหัสผ่าน? กู้คืนด้วยอีเมล
              </Link>
            </div>
          ) : null}
          <button
            className="mongkol-button button-wide"
            disabled={Boolean(pending)}
            type="submit"
          >
            {pending === "email" ? (
              <LoaderCircle className="spinner" size={18} />
            ) : null}
            {signup ? "สร้างบัญชี" : "เข้าสู่ระบบ"}
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="auth-switch">
          {signup ? "มีบัญชีแล้ว?" : "ยังไม่มีบัญชี?"}{" "}
          <Link
            className="text-link"
            href={`${signup ? "/login" : "/register"}${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`}
          >
            {signup ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </Link>
        </p>
        <p className="auth-note">
          ลืมรหัสผ่านใช่ไหม?{" "}
          <Link className="text-link" href="/forgot-password">
            กู้คืนรหัสผ่านผ่านอีเมลได้ที่นี่
          </Link>
        </p>
      </div>
    </div>
  );
}
