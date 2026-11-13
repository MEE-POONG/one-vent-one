import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  QrCode,
  Ticket,
  Wallet,
} from "lucide-react";

export const metadata = {
  title: "คำถามที่พบบ่อย (FAQ)",
  description:
    "รวมคำถามและคำตอบที่พบบ่อยเกี่ยวกับการจองโต๊ะและบัตรอีเวนต์ การชำระเงินภายใน 5 นาที และการใช้งาน QR Code เข้างาน",
};

const faqCategories = [
  {
    id: "booking",
    kicker: "BOOKING",
    title: "การจองโต๊ะและบัตร",
    icon: CalendarCheck,
    items: [
      {
        question: "จะจองโต๊ะหรือบัตรอีเวนต์ได้อย่างไร?",
        answer: (
          <>
            เลือกอีเวนต์ที่ต้องการจากหน้า{" "}
            <Link href="/events" className="text-link">
              อีเวนต์ทั้งหมด
            </Link>{" "}
            จากนั้นเลือกโซนโต๊ะ ที่นั่ง หรือประเภทบัตรที่ต้องการ
            กดยอมรับเงื่อนไขและสแกน QR Code ชำระเงินภายใน 5 นาที
            ดูขั้นตอนโดยละเอียดได้ที่หน้า{" "}
            <Link href="/how-to-book" className="text-link">
              วิธีการจอง
            </Link>
          </>
        ),
        defaultOpen: true,
      },
      {
        question: "มีเวลาในการทำรายการและชำระเงินกี่นาที?",
        answer: (
          <>
            เมื่อคุณกดยืนยันสร้างรายการจองแล้ว ระบบจะล็อกโต๊ะหรือบัตรไว้ให้ชั่วคราวเป็นเวลา{" "}
            <strong>5 นาที</strong>{" "}
            กรุณาสแกน QR Code ชำระเงินให้เสร็จสิ้นภายใน 5 นาที
            หากเกินเวลาที่กำหนด ระบบจะยกเลิกรายการจองและคืนที่นั่งกลับสู่ผังอัตโนมัติ
          </>
        ),
        defaultOpen: false,
      },
      {
        question: "สามารถจองหลายโต๊ะหรือหลายที่นั่งพร้อมกันได้ไหม?",
        answer: (
          <>
            ได้ครับ สามารถเลือกหลายโต๊ะหรือหลายที่นั่งในการจองครั้งเดียวได้ตามจำนวนสิทธิ์สูงสุดที่อีเวนต์กำหนด
            โดยระบบจะคำนวณยอดชำระรวมให้อัตโนมัติแบบเรียลไทม์
          </>
        ),
        defaultOpen: false,
      },
      {
        question: "จะรู้ได้อย่างไรว่าการจองสำเร็จแล้ว?",
        answer: (
          <>
            เมื่อสแกนชำระเงินผ่าน QR Code ภายในเวลา 5 นาทีสำเร็จ
            ระบบจะเปลี่ยนสถานะเป็นยืนยันการจองและออกบัตรดิจิทัลพร้อม QR Code ให้ทันที
            คุณสามารถตรวจสอบรายการจองและบัตรได้ตลอดเวลาที่เมนู{" "}
            <Link href="/account/bookings" className="text-link">
              ตรวจสอบการจอง
            </Link>
          </>
        ),
        defaultOpen: false,
      },
    ],
  },
  {
    id: "payment",
    kicker: "PAYMENT & CONDITIONS",
    title: "การชำระเงินและเงื่อนไข",
    icon: Wallet,
    items: [
      {
        question: "ชำระเงินผ่านช่องทางไหนได้บ้าง?",
        answer: (
          <>
            ระบบรองรับการสแกนชำระเงินผ่าน <strong>QR Code อัตโนมัติ</strong>{" "}
            ซึ่งสร้างขึ้นเฉพาะสำหรับรายการจองของคุณและมีอายุการใช้งาน{" "}
            <strong>5 นาที</strong> ทำให้ยืนยันยอดและรับบัตรได้ทันทีโดยไม่ต้องรอเจ้าหน้าที่ตรวจสอบสลิป
          </>
        ),
        defaultOpen: true,
      },
      {
        question: "ถ้าทำรายการไม่ทันภายใน 5 นาทีจน QR Code หมดอายุ ต้องทำอย่างไร?",
        answer: (
          <>
            หาก QR Code หมดอายุหลังครบ 5 นาที รายการจองเดิมจะถูกยกเลิกโดยอัตโนมัติ
            คุณสามารถกลับไปที่หน้าอีเวนต์เพื่อเลือกโต๊ะหรือที่นั่งว่างและสร้างรายการจองใหม่ได้ทันที
          </>
        ),
        defaultOpen: false,
      },
      {
        question: "สามารถยกเลิกการจองหรือขอคืนเงินได้ไหม?",
        answer: (
          <>
            สำหรับรายการที่ยังไม่ได้ชำระเงิน คุณสามารถกดยกเลิกได้ทันทีหรือปล่อยให้หมดเวลา 5 นาที
            ส่วนรายการที่ชำระเงินและออกบัตรเรียบร้อยแล้ว
            การคืนเงินจะขึ้นอยู่กับนโยบายของแต่ละอีเวนต์และดำเนินการโดยเจ้าหน้าที่ของทางร้าน
          </>
        ),
        defaultOpen: false,
      },
    ],
  },
  {
    id: "qrcode",
    kicker: "QR CODE & CHECK-IN",
    title: "QR Code และการเข้างาน",
    icon: QrCode,
    items: [
      {
        question: "QR Code สำหรับเข้างานอยู่ที่ไหน?",
        answer: (
          <>
            หลังจากชำระเงินสำเร็จ QR Code จะแสดงอยู่ในหน้าคำสั่งซื้อทันที
            และสามารถเปิดดูย้อนหลังได้ทุกเมื่อที่หน้า{" "}
            <Link href="/account/bookings" className="text-link">
              ตรวจสอบการจอง
            </Link>
          </>
        ),
        defaultOpen: true,
      },
      {
        question: "หากหน้างานอินเทอร์เน็ตช้าหรือแบตเตอรี่โทรศัพท์เหลือน้อย ควรเตรียมตัวอย่างไร?",
        answer: (
          <>
            แนะนำให้<strong>บันทึกภาพหน้าจอ (Screenshot)</strong> บัตรดิจิทัลที่มี QR Code
            และรหัสการจองเก็บไว้ในเครื่องทันทีหลังชำระเงินสำเร็จ
            เพื่อใช้แสดงต่อเจ้าหน้าที่จุดเช็คอินหน้างานได้อย่างรวดเร็ว
          </>
        ),
        defaultOpen: false,
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="mongkol-page customer-page guide-page">
      <section className="customer-hero">
        <div className="mongkol-container">
          <Link href="/events" className="view-all-button customer-back-link">
            <ArrowLeft size={17} />
            <span>ดูตารางอีเวนต์ทั้งหมด</span>
          </Link>
          <div className="section-kicker" style={{ marginTop: 22 }}>
            <span /> FREQUENTLY ASKED QUESTIONS
          </div>
          <div className="mongkol-section-head" style={{ marginBottom: 0 }}>
            <div>
              <h1>
                คำถามที่<span className="guide-accent">พบบ่อย (FAQ)</span>
              </h1>
              <p>
                รวมคำถามและคำตอบเกี่ยวกับขั้นตอนการจอง เงื่อนไขการชำระเงินภายใน 5 นาที
                และการใช้ QR Code เช็คอินเข้างาน
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mongkol-section guide-content-section">
        <div className="mongkol-container guide-container">
          <div className="faq-category-stack">
            {faqCategories.map((category) => {
              const Icon = category.icon;
              return (
                <div key={category.id} className="faq-category-block">
                  <div className="faq-category-head">
                    <span className="faq-category-icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <div>
                      <small>{category.kicker}</small>
                      <h2>{category.title}</h2>
                    </div>
                  </div>

                  <div className="customer-card faq-accordion-card">
                    {category.items.map((item) => (
                      <details
                        key={item.question}
                        className="faq-accordion-item"
                        open={item.defaultOpen}
                      >
                        <summary className="faq-accordion-summary">
                          <span>{item.question}</span>
                          <ChevronDown size={18} className="faq-accordion-chevron" />
                        </summary>
                        <div className="faq-accordion-body">
                          <p>{item.answer}</p>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="customer-card faq-help-card">
            <span className="faq-help-icon" aria-hidden="true">
              <HelpCircle size={24} />
            </span>
            <div>
              <h2>ยังมีคำถามอื่นเพิ่มเติมหรือไม่?</h2>
              <p>
                สามารถศึกษาขั้นตอนการจองโดยละเอียด หรือติดต่อสอบถามทีมงานโดยตรงผ่านช่องทางโซเชียลมีเดียของร้าน
              </p>
            </div>
            <div className="guide-cta-row">
              <Link href="/#contact" className="mongkol-button">
                <MessageCircle size={18} />
                <span>ติดต่อเรา</span>
                <ArrowRight size={17} />
              </Link>
              <Link href="/how-to-book" className="view-all-button">
                <Ticket size={17} />
                <span>ดูวิธีการจอง</span>
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

