import Link from "next/link";
import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  Clock3,
  Lightbulb,
  QrCode,
  ScanLine,
  Search,
  ShieldCheck,
  Ticket,
} from "lucide-react";

export const metadata = {
  title: "วิธีการจอง",
  description:
    "วิธีการจองโต๊ะและบัตรอีเวนต์ออนไลน์ผ่าน OneVentOne ง่าย ๆ เพียง 4 ขั้นตอน",
};

const steps = [
  {
    number: "01",
    icon: Search,
    title: "เลือกอีเวนต์ที่สนใจ",
    description: (
      <>
        เข้าไปที่หน้า <Link href="/events">อีเวนต์ทั้งหมด</Link>{" "}
        แล้วเลือกอีเวนต์ที่คุณต้องการเข้าร่วม สามารถค้นหาชื่ออีเวนต์ ศิลปิน
        หรือกรองตามช่วงเวลาและเดือนที่จัดงานได้ทันที
      </>
    ),
    points: [
      "ดูรายละเอียดอีเวนต์ วันเวลา สถานที่ และราคาบัตรเริ่มต้น",
      "ตรวจสอบโซนที่นั่ง โต๊ะ หรือประเภทบัตรที่เปิดจำหน่าย",
      "อ่านข้อกำหนดและเงื่อนไขการจองก่อนดำเนินการ",
    ],
  },
  {
    number: "02",
    icon: Armchair,
    title: "เลือกโต๊ะ ที่นั่ง หรือประเภทบัตร",
    description:
      "เลือกโต๊ะหรือที่นั่งที่ต้องการจากผังร้านแบบอินเทอร์แอคทีฟ หรือเลือกประเภทบัตรยืน (GA) และระบุจำนวนที่ต้องการ",
    points: [
      "คลิกเลือกโต๊ะหรือที่นั่งว่างจากผังงานได้โดยตรง",
      "ตรวจสอบจำนวนสิทธิ์เข้างาน (Admission) และราคารวมแบบเรียลไทม์",
      "กดยอมรับเงื่อนไขการจองและยืนยันเพื่อสร้างรายการจอง",
    ],
  },
  {
    number: "03",
    icon: ScanLine,
    title: "สแกน QR Code ชำระเงินภายใน 5 นาที",
    description:
      "ระบบจะล็อกที่นั่งหรือบัตรให้คุณชั่วคราวและสร้าง QR Code สำหรับชำระเงินอัตโนมัติ กรุณาสแกนชำระเงินให้เสร็จสิ้นภายในเวลา 5 นาที",
    points: [
      "เมื่อสร้างรายการจอง ระบบจะถือครองสิทธิ์ที่นั่งไว้ให้เป็นเวลา 5 นาที",
      "สแกน QR Code เพื่อชำระเงินตามยอดที่แสดงบนหน้าจอ",
      "ระบบตรวจสอบยอดชำระอัตโนมัติและยืนยันสถานะการจองทันทีโดยไม่ต้องรอแอดมินอนุมัติสลิป",
      "หากไม่ชำระเงินภายใน 5 นาที รายการจองจะหมดอายุและคืนที่นั่งกลับสู่ระบบโดยอัตโนมัติ",
    ],
  },
  {
    number: "04",
    icon: QrCode,
    title: "รับบัตรดิจิทัลพร้อม QR Code เข้างาน",
    description:
      "เมื่อชำระเงินสำเร็จ คุณจะได้รับบัตรเข้างานดิจิทัลพร้อม QR Code และรหัสความปลอดภัยสำหรับแสดงต่อเจ้าหน้าที่หน้างานทันที",
    points: [
      "บันทึกภาพหน้าจอ (Screenshot) หรือเปิดบัตรจากหน้าตรวจสอบการจองในวันงาน",
      "บัตรแต่ละใบมี QR Code เฉพาะตัวสำหรับสแกนเช็คอินเข้างาน",
      "สามารถตรวจสอบประวัติและสถานะบัตรได้ตลอดเวลาที่เมนูตรวจสอบการจอง",
    ],
  },
];

export default function HowToBookPage() {
  return (
    <div className="mongkol-page customer-page guide-page">
      <section className="customer-hero">
        <div className="mongkol-container">
          <Link href="/events" className="view-all-button customer-back-link">
            <ArrowLeft size={17} />
            <span>ดูตารางอีเวนต์ทั้งหมด</span>
          </Link>
          <div className="section-kicker" style={{ marginTop: 22 }}>
            <span /> HOW TO BOOK
          </div>
          <div className="mongkol-section-head" style={{ marginBottom: 0 }}>
            <div>
              <h1>
                วิธีการจอง<span className="guide-accent">โต๊ะและบัตร</span>
              </h1>
              <p>
                จองโต๊ะหรือบัตรเข้างานได้ง่าย ๆ เพียง 4 ขั้นตอน
                พร้อมระบบชำระเงินผ่าน QR Code อัตโนมัติภายในเวลา 5 นาที
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mongkol-section guide-content-section">
        <div className="mongkol-container guide-container">
          <div className="guide-steps-list">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.number} className="customer-card guide-step-card">
                  <div className="guide-step-badge-col">
                    <span className="guide-step-num">{step.number}</span>
                    <span className="guide-step-icon" aria-hidden="true">
                      <Icon size={22} />
                    </span>
                  </div>
                  <div className="guide-step-body">
                    <h2>{step.title}</h2>
                    <p className="guide-step-desc">{step.description}</p>
                    <ul className="guide-step-points">
                      {step.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="customer-card guide-tips-card">
            <div className="guide-tips-head">
              <span className="guide-tips-icon" aria-hidden="true">
                <Lightbulb size={20} />
              </span>
              <div>
                <div className="section-kicker">
                  <span /> BOOKING CONDITIONS & TIPS
                </div>
                <h2>เงื่อนไขการจองและคำแนะนำสำคัญ (ภายใน 5 นาที)</h2>
              </div>
            </div>

            <div className="notice guide-hold-highlight">
              <Clock3 size={20} />
              <p>
                <strong>เงื่อนไขเวลาชำระเงิน 5 นาที:</strong> เมื่อกดยืนยันสร้างรายการจองแล้ว
                ระบบจะสำรองที่นั่งและสร้าง QR Code ให้คุณเป็นเวลา{" "}
                <strong>5 นาที</strong> กรุณาชำระเงินให้สำเร็จภายในเวลาที่กำหนด
                มิฉะนั้นรายการจองจะถูกยกเลิกอัตโนมัติเพื่อให้ลูกค้าท่านอื่นสามารถเลือกจองต่อได้
              </p>
            </div>

            <ul className="guide-tips-list">
              <li>
                <ShieldCheck size={16} />
                <span>
                  จองล่วงหน้าเพื่อให้ได้โซนโต๊ะหรือที่นั่งที่ต้องการ
                  โดยเฉพาะอีเวนต์พิเศษที่มีจำนวนที่นั่งจำกัด
                </span>
              </li>
              <li>
                <ShieldCheck size={16} />
                <span>
                  เตรียมแอปพลิเคชันธนาคารให้พร้อมก่อนกดยืนยันการจอง
                  เพื่อให้สแกนชำระเงินได้ทันภายในเวลา <strong>5 นาที</strong>
                </span>
              </li>
              <li>
                <ShieldCheck size={16} />
                <span>
                  หลังชำระเงินสำเร็จ แนะนำให้บันทึกภาพหน้าจอ (Screenshot)
                  บัตรเข้างานและ QR Code เก็บไว้ในเครื่องเพื่อความรวดเร็วในการเช็คอินหน้างาน
                </span>
              </li>
              <li>
                <ShieldCheck size={16} />
                <span>
                  ตรวจสอบเงื่อนไขการเข้างานและการคืนเงินของแต่ละอีเวนต์ก่อนทำการจองทุกครั้ง
                </span>
              </li>
            </ul>

            <div className="guide-cta-row">
              <Link href="/events" className="mongkol-button">
                <Ticket size={18} />
                <span>เลือกดูอีเวนต์ทั้งหมด</span>
                <ArrowRight size={17} />
              </Link>
              <Link href="/faq" className="view-all-button">
                <span>ดูคำถามที่พบบ่อย (FAQ)</span>
                <ArrowRight size={17} />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

