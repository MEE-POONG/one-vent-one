import Link from "next/link";
import { Empty } from "@/components/ui";
export default function NotFound() {
  return (
    <div className="container section">
      <Empty title="ไม่พบหน้าที่ต้องการ">
        <p>ลิงก์อาจเปลี่ยนไปหรือไม่มีข้อมูลนี้แล้ว</p>
        <Link className="button" href="/events">
          กลับไปดูอีเวนท์
        </Link>
      </Empty>
    </div>
  );
}
