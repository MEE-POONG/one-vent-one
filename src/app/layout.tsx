import type { Metadata } from "next";
import type { CSSProperties } from "react";
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
export default async function RootLayout({
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
    <html lang="th" data-scroll-behavior="smooth">
      <body
        style={primary ? ({ "--accent": primary } as CSSProperties) : undefined}
      >
        <a className="skip-link" href="#main-content">
          ข้ามไปยังเนื้อหา
        </a>
        <SiteHeader businessName={business?.displayName} logo={logo} />
        <main id="main-content">{children}</main>
        <footer className="site-footer">
          <div>
            <Link className="brand" href="/">
              OneVent<span>One</span>
            </Link>
            <p>Every mood, all in one place</p>
          </div>
          {business ? (
            <div className="actions">
              {logo ? (
                <Image
                  src={logo}
                  alt={`โลโก้ ${business.displayName}`}
                  width={logo === oneVentOneLogo ? 144 : 48}
                  height={48}
                  unoptimized
                  style={{ objectFit: logo === oneVentOneLogo ? "cover" : "contain" }}
                />
              ) : null}
              <div>
                <strong>{business.displayName}</strong>
                {typeof contact?.address === "string" ? (
                  <p>{contact.address}</p>
                ) : null}
                {typeof contact?.phone === "string" && contact.phone ? (
                  <p>โทร. {contact.phone}</p>
                ) : null}
                {typeof contact?.line === "string" && contact.line ? (
                  <p>LINE: {contact.line}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p>หนึ่งอีเวนท์ · ทุกช่วงเวลาของคุณ</p>
          )}
        </footer>
      </body>
    </html>
  );
}
