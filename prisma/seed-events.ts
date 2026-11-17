import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export type SampleTableEventConfig = {
  slug: string;
  title: string;
  artists: string[];
  posterUrl: string;
  daysAway: number;
  color: string;
  description: string;
  zoneName: string;
  rows: number;
  cols: number;
  frontRows: number;
  frontSeats: number;
  frontPriceSatang: number;
  regularSeats: number;
  regularPriceSatang: number;
};

export const sampleTableEvents: SampleTableEventConfig[] = [
  {
    slug: "demo-red-night",
    title: "Red Night Live",
    artists: ["Red Night Band", "DJ Crimson"],
    posterUrl: "/events/red-night.png",
    daysAway: 8,
    color: "#F04438",
    description:
      "ค่ำคืนร็อกสดท่ามกลางแสงสีแดง พร้อมเพลงที่อยากร้องไปด้วยกัน เปิดจองเฉพาะรูปแบบโต๊ะสำหรับแก๊งเพื่อน (ทั้งหมด 30 โต๊ะ)",
    zoneName: "โซนโต๊ะ Red Room",
    rows: 5,
    cols: 6,
    frontRows: 2,
    frontSeats: 4,
    frontPriceSatang: 160000,
    regularSeats: 4,
    regularPriceSatang: 120000,
  },
  {
    slug: "demo-moonlight-acoustic",
    title: "Moonlight Acoustic",
    artists: ["Moonlight Session", "Nalin Trio"],
    posterUrl: "/events/moonlight-acoustic.png",
    daysAway: 15,
    color: "#729BEA",
    description:
      "เสียงกีตาร์และเพลงโปรดในบรรยากาศอบอุ่น ใกล้ชิดกับศิลปินตลอดค่ำคืน เปิดจองเฉพาะรูปแบบโต๊ะนั่งชิลล์ (ทั้งหมด 20 โต๊ะ)",
    zoneName: "โซนโต๊ะ Acoustic Lounge",
    rows: 4,
    cols: 5,
    frontRows: 2,
    frontSeats: 4,
    frontPriceSatang: 120000,
    regularSeats: 4,
    regularPriceSatang: 90000,
  },
  {
    slug: "demo-neon-after-hours",
    title: "Neon After Hours",
    artists: ["Neon Collective", "DJ Pulse"],
    posterUrl: "/events/neon-after-hours.png",
    daysAway: 22,
    color: "#C86AE8",
    description:
      "จังหวะอิเล็กทรอนิกส์ แสงนีออน และดีเจเซ็ตสำหรับคืนที่อยากอยู่ให้นานขึ้น เปิดจองโต๊ะ VIP หน้าเวที 6 ที่นั่ง และโต๊ะมาตรฐาน 4 ที่นั่ง (ทั้งหมด 24 โต๊ะ)",
    zoneName: "โซนโต๊ะ Neon Club",
    rows: 4,
    cols: 6,
    frontRows: 1,
    frontSeats: 6,
    frontPriceSatang: 280000,
    regularSeats: 4,
    regularPriceSatang: 150000,
  },
];

export async function upsertTableEvent(
  venueName: string,
  config: SampleTableEventConfig,
) {
  const now = new Date();
  const startsAt = new Date(now.getTime() + config.daysAway * 86400000);
  startsAt.setUTCHours(13, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 4 * 3600000);
  const saleStartsAt = new Date(now.getTime() - 86400000);
  const saleEndsAt = new Date(startsAt.getTime() - 3600000);

  const event = await prisma.event.upsert({
    where: { slug: config.slug },
    update: {
      title: config.title,
      description: config.description,
      artists: config.artists,
      venue: venueName,
      posterUrl: config.posterUrl,
      showInSlider: true,
    },
    create: {
      slug: config.slug,
      title: config.title,
      description: config.description,
      artists: config.artists,
      venue: venueName,
      posterUrl: config.posterUrl,
      startsAt,
      endsAt,
      saleStartsAt,
      saleEndsAt,
      status: "DRAFT",
      showInSlider: true,
    },
  });

  const totalTables = config.rows * config.cols;
  const totalCapacity =
    config.frontRows * config.cols * config.frontSeats +
    (config.rows - config.frontRows) * config.cols * config.regularSeats;

  const tableZone = await prisma.zone.upsert({
    where: { eventId_code: { eventId: event.id, code: "TABLE" } },
    update: {
      name: config.zoneName,
      sellingMode: "TABLE",
      capacity: totalCapacity,
      color: config.color,
    },
    create: {
      eventId: event.id,
      code: "TABLE",
      name: config.zoneName,
      sellingMode: "TABLE",
      capacity: totalCapacity,
      color: config.color,
    },
  });

  // Deactivate any legacy SEAT units or GA ticket types if no active bookings depend on them
  await prisma.ticketType.updateMany({
    where: { eventId: event.id },
    data: { active: false },
  });
  await prisma.bookableUnit.updateMany({
    where: { eventId: event.id, sellingMode: "SEAT" },
    data: { active: false },
  });

  const canvasWidth = 1000;
  const tileWidth = 114;
  const tileHeight = 94;
  const colGap = 24;
  const rowGap = 18;
  const gridWidth = config.cols * tileWidth + (config.cols - 1) * colGap;
  const startX = Math.round((canvasWidth - gridWidth) / 2);
  const startY = 148;
  const gridHeight = config.rows * tileHeight + (config.rows - 1) * rowGap;
  const zoneBoxX = Math.max(36, startX - 28);
  const zoneBoxY = 118;
  const zoneBoxWidth = canvasWidth - zoneBoxX * 2;
  const zoneBoxHeight = gridHeight + 56;
  const canvasHeight = zoneBoxY + zoneBoxHeight + 92;

  const objects: Record<string, unknown>[] = [
    {
      id: "stage-main",
      type: "stage",
      shape: "rect",
      code: "STAGE",
      name: "STAGE / เวทีการแสดง",
      x: 280,
      y: 26,
      width: 440,
      height: 66,
      rotation: 0,
    },
    {
      id: "zone-tables",
      type: "zone",
      shape: "rect",
      code: "ZONE-TABLE",
      name: `${config.zoneName} (${totalTables} โต๊ะ)`,
      zoneId: tableZone.id,
      color: config.color,
      x: zoneBoxX,
      y: zoneBoxY,
      width: zoneBoxWidth,
      height: zoneBoxHeight,
      rotation: 0,
    },
    {
      id: "entrance-main",
      type: "entrance",
      shape: "rect",
      code: "ENTRY",
      name: "ทางเข้า",
      x: 410,
      y: zoneBoxY + zoneBoxHeight + 24,
      width: 180,
      height: 42,
      rotation: 0,
    },
  ];

  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      const index = r * config.cols + c + 1;
      const code = `T${String(index).padStart(2, "0")}`;
      const isFront = r < config.frontRows;
      const admissionCount = isFront ? config.frontSeats : config.regularSeats;
      const priceSatang = isFront
        ? config.frontPriceSatang
        : config.regularPriceSatang;

      const unit = await prisma.bookableUnit.upsert({
        where: { eventId_code: { eventId: event.id, code } },
        update: {
          zoneId: tableZone.id,
          name: `โต๊ะ ${code}`,
          sellingMode: "TABLE",
          admissionCount,
          priceSatang,
          active: true,
        },
        create: {
          eventId: event.id,
          zoneId: tableZone.id,
          code,
          name: `โต๊ะ ${code}`,
          sellingMode: "TABLE",
          admissionCount,
          priceSatang,
          active: true,
        },
      });

      await prisma.unitInventory.upsert({
        where: { eventId_unitId: { eventId: event.id, unitId: unit.id } },
        update: {},
        create: { eventId: event.id, unitId: unit.id, status: "AVAILABLE" },
      });

      objects.push({
        id: `unit-${unit.id}`,
        type: "table",
        shape: "rect",
        code,
        name: unit.name,
        unitId: unit.id,
        zoneId: tableZone.id,
        x: startX + c * (tileWidth + colGap),
        y: startY + r * (tileHeight + rowGap),
        width: tileWidth,
        height: tileHeight,
        rotation: 0,
      });
    }
  }

  const geometry = { objects } as Prisma.InputJsonValue;
  const template = await prisma.layoutTemplate.upsert({
    where: { eventId: event.id },
    update: {
      name: `ผังโต๊ะ ${config.title}`,
      width: canvasWidth,
      height: canvasHeight,
      geometry,
      revision: { increment: 1 },
    },
    create: {
      eventId: event.id,
      name: `ผังโต๊ะ ${config.title}`,
      width: canvasWidth,
      height: canvasHeight,
      geometry,
    },
  });

  const latestVersion = await prisma.layoutVersion.findFirst({
    where: { eventId: event.id },
    orderBy: { version: "desc" },
  });
  const nextVersionNumber = (latestVersion?.version ?? 0) + 1;

  const layoutVersion = await prisma.layoutVersion.create({
    data: {
      eventId: event.id,
      templateId: template.id,
      version: nextVersionNumber,
      width: canvasWidth,
      height: canvasHeight,
      geometry,
    },
  });

  return prisma.event.update({
    where: { id: event.id },
    data: {
      status: "PUBLISHED",
      publishedLayoutVersionId: layoutVersion.id,
      showInSlider: true,
    },
  });
}

async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    process.env.NODE_ENV === "production" ||
    !["127.0.0.1", "localhost"].includes(url.hostname)
  )
    throw new Error("Sample events require a local development database.");

  const business = await prisma.businessProfile.findUniqueOrThrow({
    where: { key: "primary" },
  });

  for (const sample of sampleTableEvents) {
    const event = await upsertTableEvent(business.displayName, sample);
    console.log(
      `Sample table event ready: ${event.title} (${event.slug}) — ${sample.rows * sample.cols} tables`,
    );
  }
}

if (process.argv[1]?.endsWith("seed-events.ts")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
