import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/site-header";
import { getBusinessProfile } from "@/server/services/catalog";
import { oneVentOneLogo } from "@/shared/images";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "OneVentOne — ทุกคืนพิเศษ เริ่มที่นี่",
    template: "%s | OneVentOne",
  },
  description:
    "เลือกอีเวนท์ จองโต๊ะหรือบัตร และจัดการการจองของคุณกับ OneVentOne",
};
async function SiteContent({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const business = await getBusinessProfile().catch(() => null);
  const contact = business?.contact as Record<string, unknown> | undefined;
  const theme = business?.theme as { primary?: string } | undefined;
  const primary =
    theme?.primary && /^#[0-9a-f]{6}$/i.test(theme.primary)
      ? theme.primary
      : undefined;
  const logo =
    business?.logo && /^(https:\/\/|\/(?!\/))/.test(business.logo)
      ? business.logo
      : oneVentOneLogo;
  return (
    <div
      className="site-content"
      style={primary ? ({ "--accent": primary } as CSSProperties) : undefined}
    >
      <a className="skip-link" href="#main-content">
        ข้ามไปยังเนื้อหา
      </a>
      <SiteHeader businessName={business?.displayName} logo={logo} />
      <main id="main-content">{children}</main>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-grid">
            <div className="site-footer-brand">
              <Link
                className="footer-logo-link"
                href="/"
                aria-label={`${business?.displayName || "OneVentOne"} หน้าแรก`}
              >
                {logo ? (
                  <Image
                    src={logo}
                    alt={`โลโก้ ${business?.displayName || "OneVentOne"}`}
                    width={logo === oneVentOneLogo ? 144 : 48}
                    height={48}
                    unoptimized
                    style={{
                      objectFit: logo === oneVentOneLogo ? "cover" : "contain",
                    }}
                  />
                ) : (
                  <span className="brand">
                    OneVent<span>One</span>
                  </span>
                )}
              </Link>
              <p className="footer-tagline">Every mood, all in one place</p>
              {business ? (
                <div className="footer-venue-info">
                  <strong>{business.displayName}</strong>
                  {typeof contact?.address === "string" && contact.address ? (
                    <p>{contact.address}</p>
                  ) : null}
                </div>
              ) : (
                <p className="footer-venue-info">
                  หนึ่งอีเวนท์ · ทุกช่วงเวลาของคุณ
                </p>
              )}
            </div>

            <div className="site-footer-col">
              <h4 className="footer-title">หน้าหลัก</h4>
              <div className="footer-links">
                <Link href="/">หน้าแรก</Link>
                <Link href="/events">อีเวนต์ทั้งหมด</Link>
              </div>
            </div>

            <div className="site-footer-col">
              <h4 className="footer-title">เกี่ยวกับเรา</h4>
              <div className="footer-links">
                <Link href="/how-to-book">วิธีการจอง</Link>
                <Link href="/faq">คำถามที่พบบ่อย (FAQ)</Link>
                <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
                <Link href="/terms">เงื่อนไขการใช้งาน</Link>
              </div>
            </div>
          </div>

          <div className="site-footer-bottom">
            <p>
              &copy; {new Date().getFullYear()} OneVentOne. All rights reserved.
            </p>
            <p>Every mood, all in one place</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" data-scroll-behavior="smooth">
      <body>
        <Suspense fallback={null}>
          <SiteContent>{children}</SiteContent>
        </Suspense>
      </body>
    </html>
  );
}
