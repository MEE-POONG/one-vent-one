import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import { oneVentOneLogo } from "../src/shared/images";
import { sampleTableEvents, upsertTableEvent } from "./seed-events";

const prisma = new PrismaClient();

async function main() {
  await prisma.businessProfile.upsert({
    where: { key: "primary" },
    update: {},
    create: {
      key: "primary",
      displayName: "มงคลบาร์",
      logo: oneVentOneLogo,
      holdMinutes: 5,
      theme: {
        background: "#0B0B0F",
        panel: "#18181B",
        primary: "#E11D48",
        text: "#F4F4F5",
      },
      contact: {
        address: "มงคลบาร์ · ข้อมูลกรณีศึกษาสำหรับการพัฒนา",
        phone: "",
        line: "",
        email: "",
      },
      paymentInstructions: {
        bankName: "บัญชีตัวอย่าง — ยังไม่เปิดรับเงินจริง",
        accountName: "ร้านมงคลบาร์ (ข้อมูลสาธิต)",
        accountNumber: "",
        note: "ข้อมูลสำหรับทดลองระบบเท่านั้น ผู้ดูแลต้องตั้งค่าบัญชีรับเงินจริงก่อนเปิดขาย",
      },
      bookingPolicy: {
        holdMinutes: 5,
        reviewHours: 24,
        correctionHours: 24,
        maxAdmissions: 20,
        terms:
          "ชำระเงินเต็มจำนวนผ่าน QR Code ภายใน 5 นาทีก่อนหมดเวลา ระบบออกบัตรเข้างานพร้อม QR Code ทันทีเมื่อชำระเงินสำเร็จ โต๊ะ 1 โต๊ะรับสิทธิ์เข้าตามจำนวนที่นั่งที่ระบุในแต่ละโต๊ะ การคืนเงินดำเนินการโดยเจ้าหน้าที่ภายนอกระบบ",
      },
    },
  });

  const currentProfile = await prisma.businessProfile.findUnique({
    where: { key: "primary" },
  });
  if (currentProfile) {
    const policy =
      (currentProfile.bookingPolicy as Record<string, unknown> | null) ?? {};
    const terms =
      typeof policy.terms === "string"
        ? policy.terms.replace(/ภายใน\s*15\s*นาที/g, "ภายใน 5 นาที")
        : policy.terms;
    const holdMinutes =
      Number(policy.holdMinutes) === 15 ? 5 : (policy.holdMinutes ?? 5);
    if (
      currentProfile.holdMinutes === 15 ||
      policy.holdMinutes === 15 ||
      terms !== policy.terms
    ) {
      await prisma.businessProfile.update({
        where: { key: "primary" },
        data: {
          holdMinutes:
            currentProfile.holdMinutes === 15 ? 5 : currentProfile.holdMinutes,
          bookingPolicy: {
            ...policy,
            holdMinutes,
            terms,
          } as Prisma.InputJsonValue,
        },
      });
    }
  }

  const venueName = currentProfile?.displayName || "มงคลบาร์";

  await upsertTableEvent(venueName, {
    slug: "mongkol-live-session",
    title: "MONGKOL LIVE SESSION",
    artists: ["Mongkol House Band", "Special Guest Session"],
    posterUrl: "/concert-hero.png",
    daysAway: 30,
    color: "#E11D48",
    description:
      "ค่ำคืนของเสียงเพลงและคนที่คุณอยากชวนมาเจอ ดนตรีสดในบรรยากาศใกล้ชิด เลือกจองโต๊ะสำหรับกลุ่มเพื่อนล่วงหน้าพร้อมรับบัตร QR Code ทันที (ทั้งหมด 24 โต๊ะ)",
    zoneName: "โซนโต๊ะเพื่อนซี้",
    rows: 4,
    cols: 6,
    frontRows: 2,
    frontSeats: 4,
    frontPriceSatang: 240000,
    regularSeats: 4,
    regularPriceSatang: 180000,
  });

  for (const sample of sampleTableEvents) {
    await upsertTableEvent(venueName, sample);
  }

  console.log(
    "Seed ready: มงคลบาร์ + 4 อีเวนต์รูปแบบจองโต๊ะ (MONGKOL LIVE SESSION 24 โต๊ะ, Red Night Live 30 โต๊ะ, Moonlight Acoustic 20 โต๊ะ, Neon After Hours 24 โต๊ะ) พร้อมเปิดแสดงบน Slide Show หน้าแรก",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
