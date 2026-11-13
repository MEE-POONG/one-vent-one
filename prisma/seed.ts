import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import { oneVentOneLogo } from "../src/shared/images";

const prisma = new PrismaClient();

async function main() {
  await prisma.businessProfile.upsert({
    where: { key: "primary" },
    update: {},
    create: {
      key: "primary",
      displayName: "มงคลบาร์",
      logo: oneVentOneLogo,
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
        holdMinutes: 15,
        reviewHours: 24,
        correctionHours: 24,
        maxAdmissions: 20,
        terms:
          "ชำระเต็มจำนวนภายใน 15 นาที และส่งหลักฐานก่อนหมดเวลา ผู้ดูแลตรวจเงินจริงก่อนออกบัตร โต๊ะ 1 โต๊ะรับสิทธิ์เข้า 4 คน การคืนเงินดำเนินการโดยเจ้าหน้าที่ภายนอกระบบ",
      },
    },
  });
  const now = new Date();
  const startsAt = new Date(now.getTime() + 30 * 86400000);
  startsAt.setUTCHours(13, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 4 * 3600000);
  const saleStartsAt = new Date(now.getTime() - 86400000);
  const saleEndsAt = new Date(startsAt.getTime() - 3600000);
  const event = await prisma.event.upsert({
    where: { slug: "mongkol-live-session" },
    update: {},
    create: {
      slug: "mongkol-live-session",
      title: "MONGKOL LIVE SESSION",
      description:
        "ค่ำคืนของเสียงเพลงและคนที่คุณอยากชวนมาเจอ ดนตรีสดในบรรยากาศใกล้ชิด เลือกโต๊ะสำหรับกลุ่มเพื่อน ที่นั่งของคุณ หรือบัตรยืนหน้าเวที ข้อมูลกิจกรรมนี้เป็นกรณีศึกษาสำหรับทดลองระบบ OneVentOne",
      artists: ["Mongkol House Band", "Special Guest Session"],
      venue: "มงคลบาร์",
      posterUrl: "/concert-hero.png",
      startsAt,
      endsAt,
      saleStartsAt,
      saleEndsAt,
      status: "DRAFT",
    },
  });
  // A rerun never resets an existing event, its inventory, its prices or its published layout.
  if (event.publishedLayoutVersionId) {
    console.log(
      "Seed already exists; business settings, event and live inventory preserved.",
    );
    return;
  }
  const tableZone = await prisma.zone.upsert({
    where: { eventId_code: { eventId: event.id, code: "TABLE" } },
    update: {},
    create: {
      eventId: event.id,
      code: "TABLE",
      name: "โต๊ะเพื่อนซี้",
      sellingMode: "TABLE",
      capacity: 32,
      color: "#E11D48",
    },
  });
  const seatZone = await prisma.zone.upsert({
    where: { eventId_code: { eventId: event.id, code: "SEAT" } },
    update: {},
    create: {
      eventId: event.id,
      code: "SEAT",
      name: "ที่นั่งใกล้เวที",
      sellingMode: "SEAT",
      capacity: 12,
      color: "#A78BFA",
    },
  });
  const gaZone = await prisma.zone.upsert({
    where: { eventId_code: { eventId: event.id, code: "GA" } },
    update: {},
    create: {
      eventId: event.id,
      code: "GA",
      name: "ยืนหน้าเวที",
      sellingMode: "GENERAL_ADMISSION",
      capacity: 80,
      color: "#38BDF8",
    },
  });
  const objects: Record<string, unknown>[] = [
    {
      id: "stage-main",
      type: "stage",
      shape: "rect",
      code: "STAGE",
      name: "เวที",
      x: 300,
      y: 30,
      width: 400,
      height: 80,
      rotation: 0,
    },
    {
      id: "zone-tables",
      type: "zone",
      shape: "rect",
      code: "ZONE-TABLE",
      name: "โต๊ะเพื่อนซี้",
      zoneId: tableZone.id,
      x: 50,
      y: 160,
      width: 440,
      height: 430,
      rotation: 0,
    },
    {
      id: "zone-seats",
      type: "zone",
      shape: "rect",
      code: "ZONE-SEAT",
      name: "ที่นั่งใกล้เวที",
      zoneId: seatZone.id,
      x: 540,
      y: 160,
      width: 400,
      height: 160,
      rotation: 0,
    },
    {
      id: "zone-ga",
      type: "zone",
      shape: "rect",
      code: "ZONE-GA",
      name: "ยืนหน้าเวที",
      zoneId: gaZone.id,
      x: 540,
      y: 370,
      width: 400,
      height: 220,
      rotation: 0,
    },
    {
      id: "entrance-main",
      type: "entrance",
      shape: "rect",
      code: "ENTRY",
      name: "ทางเข้า",
      x: 420,
      y: 630,
      width: 160,
      height: 40,
      rotation: 0,
    },
  ];
  for (let i = 1; i <= 8; i++) {
    const code = `T${String(i).padStart(2, "0")}`;
    const unit = await prisma.bookableUnit.upsert({
      where: { eventId_code: { eventId: event.id, code } },
      update: {},
      create: {
        eventId: event.id,
        zoneId: tableZone.id,
        code,
        name: `โต๊ะ ${code}`,
        sellingMode: "TABLE",
        admissionCount: 4,
        priceSatang: 240000,
      },
    });
    await prisma.unitInventory.upsert({
      where: { eventId_unitId: { eventId: event.id, unitId: unit.id } },
      update: {},
      create: { eventId: event.id, unitId: unit.id },
    });
    objects.push({
      id: `unit-${unit.id}`,
      type: "table",
      shape: i % 2 ? "circle" : "rect",
      code,
      name: unit.name,
      unitId: unit.id,
      zoneId: tableZone.id,
      x: 100 + ((i - 1) % 2) * 210,
      y: 205 + Math.floor((i - 1) / 2) * 90,
      width: 65,
      height: 65,
      rotation: 0,
    });
  }
  for (let i = 1; i <= 12; i++) {
    const code = `S${String(i).padStart(2, "0")}`;
    const unit = await prisma.bookableUnit.upsert({
      where: { eventId_code: { eventId: event.id, code } },
      update: {},
      create: {
        eventId: event.id,
        zoneId: seatZone.id,
        code,
        name: `ที่นั่ง ${code}`,
        sellingMode: "SEAT",
        admissionCount: 1,
        priceSatang: 79000,
      },
    });
    await prisma.unitInventory.upsert({
      where: { eventId_unitId: { eventId: event.id, unitId: unit.id } },
      update: {},
      create: { eventId: event.id, unitId: unit.id },
    });
    objects.push({
      id: `unit-${unit.id}`,
      type: "seat",
      shape: "rect",
      code,
      name: unit.name,
      unitId: unit.id,
      zoneId: seatZone.id,
      x: 575 + ((i - 1) % 6) * 55,
      y: 205 + Math.floor((i - 1) / 6) * 60,
      width: 32,
      height: 32,
      rotation: 0,
    });
  }
  const pool = await prisma.capacityPool.upsert({
    where: { eventId_code: { eventId: event.id, code: "GA-SHARED" } },
    update: {},
    create: {
      eventId: event.id,
      zoneId: gaZone.id,
      code: "GA-SHARED",
      capacity: 80,
      available: 80,
    },
  });
  for (const ticket of [
    { code: "GA-EARLY", name: "Early Bird", priceSatang: 39000 },
    { code: "GA-REGULAR", name: "Regular", priceSatang: 49000 },
  ]) {
    await prisma.ticketType.upsert({
      where: { eventId_code: { eventId: event.id, code: ticket.code } },
      update: {},
      create: {
        ...ticket,
        eventId: event.id,
        zoneId: gaZone.id,
        poolId: pool.id,
        saleStartsAt: event.saleStartsAt,
        saleEndsAt: event.saleEndsAt,
      },
    });
  }
  const geometry = { objects } as Prisma.InputJsonValue;
  const template = await prisma.layoutTemplate.upsert({
    where: { eventId: event.id },
    update: {},
    create: {
      eventId: event.id,
      name: "ผังมงคลบาร์",
      width: 1000,
      height: 700,
      geometry,
    },
  });
  const version = await prisma.layoutVersion.upsert({
    where: { eventId_version: { eventId: event.id, version: 1 } },
    update: {},
    create: {
      eventId: event.id,
      templateId: template.id,
      version: 1,
      width: template.width,
      height: template.height,
      geometry: template.geometry as Prisma.InputJsonValue,
    },
  });
  await prisma.event.update({
    where: { id: event.id },
    data: { publishedLayoutVersionId: version.id, status: "PUBLISHED" },
  });
  console.log(
    "Seed created: มงคลบาร์, one event, 8 tables (4 admissions each), 12 seats, 80 shared GA capacity with two price tiers.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
