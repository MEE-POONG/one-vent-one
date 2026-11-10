"use client";
import { ErrorNotice, PageHeading } from "@/components/ui";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="container section">
      <PageHeading title="โหลดหน้านี้ไม่สำเร็จ" />
      <ErrorNotice
        error={new Error("ขณะนี้ยังโหลดข้อมูลไม่ได้ กรุณาลองอีกครั้ง")}
        retry={reset}
      />
    </div>
  );
}
