import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Search,
  Landmark,
  ClipboardCheck,
  Ticket,
} from "lucide-react";
import { getBusinessProfile, listEvents } from "@/server/services/catalog";
import { EventRow, Empty } from "@/components/ui";
import type { EventData } from "@/lib/client-types";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const [businessResult, eventsResult] = await Promise.allSettled([
    getBusinessProfile(),
    listEvents({ pageSize: 4 }),
  ]);
  const business =
    businessResult.status === "fulfilled" ? businessResult.value : null;
  const events: EventData[] =
    eventsResult.status === "fulfilled"
      ? JSON.parse(JSON.stringify(eventsResult.value.items))
      : [];
  return (
    <>
      <section className="hero">
        <Image src="/concert-hero.png" alt="" fill sizes="100vw" priority />
        <div className="container">
          <h1>
            คืนที่ใช่
            <br />
            กับคนที่ชอบ
          </h1>
          <p>
            เลือกอีเวนท์ที่อยากไป จองที่ของคุณ
            <br />
            แล้วเตรียมตัวพบกัน{business ? `ที่${business.displayName}` : ""}
          </p>
          <Link href="/events" className="button">
            <Search size={20} />
            ค้นหาอีเวนท์
            <ArrowRight size={21} />
          </Link>
        </div>
      </section>
      <section className="container section">
        <div className="section-head">
          <h2>อีเวนท์ที่กำลังเปิดขาย</h2>
          <Link href="/events">
            ดูทั้งหมด <ArrowRight size={17} />
          </Link>
        </div>
        {events.length ? (
          <div className="event-list">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Empty
            title={
              eventsResult.status === "rejected"
                ? "ยังโหลดรายการอีเวนท์ไม่ได้"
                : "ยังไม่มีอีเวนท์เปิดขาย"
            }
          >
            <p>
              {eventsResult.status === "rejected"
                ? "กรุณาลองใหม่ภายหลัง หรือติดต่อผู้ดูแลร้าน"
                : "กลับมาเลือกคืนพิเศษของคุณได้อีกครั้งเร็ว ๆ นี้"}
            </p>
            <Link className="text-link" href="/events">
              ดูรายการอีเวนท์
            </Link>
          </Empty>
        )}
        <div className="steps-band">
          <div>
            <Landmark size={27} />
            <div>
              <h3>โอนชำระเงิน</h3>
              <p>จองแล้วโอนเงินและส่งหลักฐานภายในเวลาที่กำหนด</p>
            </div>
          </div>
          <div>
            <ClipboardCheck size={27} />
            <div>
              <h3>รอผู้ดูแลตรวจสอบ</h3>
              <p>ร้านตรวจยอดเงินจริงก่อนยืนยันการจองของคุณ</p>
            </div>
          </div>
          <div>
            <Ticket size={27} />
            <div>
              <h3>รับบัตรเข้างาน</h3>
              <p>เปิด QR ในการจองของฉัน หลังได้รับการอนุมัติ</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
