import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const samples = [
  {
    slug: "demo-red-night",
    title: "Red Night Live",
    artist: "Red Night Band",
    poster: "red-night",
    daysAway: 8,
    priceSatang: 120000,
    color: "#F04438",
    description: "ค่ำคืนร็อกสดท่ามกลางแสงสีแดง พร้อมเพลงที่อยากร้องไปด้วยกัน",
  },
  {
    slug: "demo-moonlight-acoustic",
    title: "Moonlight Acoustic",
    artist: "Moonlight Session",
    poster: "moonlight-acoustic",
    daysAway: 15,
    priceSatang: 69000,
    color: "#729BEA",
    description:
      "เสียงกีตาร์และเพลงโปรดในบรรยากาศอบอุ่น ใกล้ชิดกับศิลปินตลอดค่ำคืน",
  },
  {
    slug: "demo-neon-after-hours",
    title: "Neon After Hours",
    artist: "Neon Collective",
    poster: "neon-after-hours",
    daysAway: 22,
    priceSatang: 89000,
    color: "#C86AE8",
    description:
      "จังหวะอิเล็กทรอนิกส์ แสงนีออน และดีเจเซ็ตสำหรับคืนที่อยากอยู่ให้นานขึ้น",
  },
];

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
  for (const sample of samples) {
    const event = await prisma.$transaction(async (tx) => {
      const existing = await tx.event.findUnique({
        where: { slug: sample.slug },
      });
      if (existing) return existing;

      const now = new Date();
      const startsAt = new Date(now.getTime() + sample.daysAway * 86400000);
      startsAt.setUTCHours(13, 0, 0, 0);
      const saleStartsAt = new Date(now.getTime() - 86400000);
      const saleEndsAt = new Date(startsAt.getTime() - 3600000);
      const created = await tx.event.create({
        data: {
          slug: sample.slug,
          title: sample.title,
          description: `${sample.description}\n\nอีเวนต์และศิลปินสมมติสำหรับทดลองระบบ OneVentOne ภาพโปสเตอร์สร้างด้วย AI ใช้ข้อมูลการชำระเงินสาธิต`,
          artists: [sample.artist],
          venue: business.displayName,
          posterUrl: `/events/${sample.poster}.png`,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 4 * 3600000),
          saleStartsAt,
          saleEndsAt,
        },
      });
      const zone = await tx.zone.create({
        data: {
          eventId: created.id,
          code: "GA",
          name: "หน้าเวที",
          sellingMode: "GENERAL_ADMISSION",
          capacity: 80,
          color: sample.color,
        },
      });
      const pool = await tx.capacityPool.create({
        data: {
          eventId: created.id,
          zoneId: zone.id,
          code: "GA-SHARED",
          capacity: 80,
          available: 80,
        },
      });
      await tx.ticketType.create({
        data: {
          eventId: created.id,
          zoneId: zone.id,
          poolId: pool.id,
          code: "GA-REGULAR",
          name: "บัตรเข้าชม",
          priceSatang: sample.priceSatang,
          saleStartsAt,
          saleEndsAt,
        },
      });
      const geometry: Prisma.InputJsonValue = {
        objects: [
          {
            id: "stage",
            type: "stage",
            shape: "rect",
            code: "STAGE",
            name: "เวที",
            x: 250,
            y: 40,
            width: 300,
            height: 90,
            rotation: 0,
          },
          {
            id: "ga",
            type: "zone",
            shape: "rect",
            code: "GA",
            name: "หน้าเวที · 80 คน",
            zoneId: zone.id,
            color: sample.color,
            x: 100,
            y: 190,
            width: 600,
            height: 280,
            rotation: 0,
          },
          {
            id: "entrance",
            type: "entrance",
            shape: "rect",
            code: "ENTRY",
            name: "ทางเข้า",
            x: 300,
            y: 510,
            width: 200,
            height: 50,
            rotation: 0,
          },
        ],
      };
      const template = await tx.layoutTemplate.create({
        data: {
          eventId: created.id,
          name: sample.title,
          width: 800,
          height: 600,
          geometry,
        },
      });
      const layout = await tx.layoutVersion.create({
        data: {
          eventId: created.id,
          templateId: template.id,
          version: 1,
          width: 800,
          height: 600,
          geometry,
        },
      });
      return tx.event.update({
        where: { id: created.id },
        data: { status: "PUBLISHED", publishedLayoutVersionId: layout.id },
      });
    });
    console.log(`Sample event ready: ${event.title} (${event.slug})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
