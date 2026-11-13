export const oneVentOneLogo = "/oneventone-logo.png";

export const imageGuidelines = {
  poster: {
    width: 1200,
    height: 1800,
    minimumWidth: 600,
    minimumHeight: 900,
    ratio: "2:3",
    recommendation:
      "แนะนำ 1,200 × 1,800 px แนวตั้ง (2:3) ขั้นต่ำที่แนะนำ 600 × 900 px",
    placement:
      "ใช้กับการ์ดอีเวนท์และรูปในผลค้นหา รูปต่างสัดส่วนจะถูกครอปจากกึ่งกลางให้เต็มกรอบ",
    designTip:
      "เว้นชื่อศิลปิน วันเวลา และข้อความสำคัญจากขอบอย่างน้อย 8% หลีกเลี่ยงมุมขวาบนที่มีป้ายวันที่ และส่วนล่างที่มีเงาทับภาพ",
  },
  logo: {
    width: 900,
    height: 300,
    minimumWidth: 300,
    minimumHeight: 100,
    ratio: "3:1",
    recommendation:
      "แนะนำ 900 × 300 px แนวนอน (3:1) ขั้นต่ำที่แนะนำ 300 × 100 px",
    placement:
      "แสดงเต็มรูปในส่วนหัวและท้ายเว็บโดยไม่ครอป โลโก้สี่เหลี่ยมจัตุรัสใช้ได้ แต่อาจมีพื้นที่ว่างด้านข้าง",
    designTip:
      "แนะนำ PNG หรือ WebP พื้นหลังโปร่งใส ใช้สีที่เห็นชัดบนพื้นเข้ม และเว้นพื้นที่ว่างรอบโลโก้ 8%",
  },
} as const;
