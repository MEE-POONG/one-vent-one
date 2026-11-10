import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";

export async function getBusinessProfile() {
  const profile = await prisma.businessProfile.findUnique({
    where: { key: "primary" },
  });
  if (!profile)
    throw new DomainError(
      "SETUP_REQUIRED",
      "ยังไม่ได้ตั้งค่าข้อมูลร้าน กรุณารันข้อมูลเริ่มต้น",
      503,
    );
  return profile;
}

export async function listEvents({
  q = "",
  page = 1,
  pageSize = 12,
}: { q?: string; page?: number; pageSize?: number } = {}) {
  const where: Prisma.EventWhereInput = {
    status: { in: ["PUBLISHED", "CLOSED", "COMPLETED"] },
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { venue: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startsAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        zones: true,
        units: { where: { active: true }, select: { priceSatang: true } },
        ticketTypes: { where: { active: true }, select: { priceSatang: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);
  return {
    items: events.map(({ units, ticketTypes, ...event }) => ({
      ...event,
      minPriceSatang:
        Math.min(
          ...[...units, ...ticketTypes].map((v) => v.priceSatang),
          Number.MAX_SAFE_INTEGER,
        ) === Number.MAX_SAFE_INTEGER
          ? null
          : Math.min(...[...units, ...ticketTypes].map((v) => v.priceSatang)),
    })),
    total,
    page,
    pageSize,
  };
}

const eventInclude = {
  zones: {
    include: {
      units: { where: { active: true } },
      ticketTypes: { where: { active: true } },
      pools: true,
    },
  },
  publishedLayoutVersion: true,
} satisfies Prisma.EventInclude;
export async function getEventBySlug(slug: string) {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: eventInclude,
  });
  if (!event || event.status === "DRAFT")
    throw new DomainError("NOT_FOUND", "ไม่พบงานที่ต้องการ", 404);
  return { ...event, layout: event.publishedLayoutVersion };
}
export async function getEventById(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: eventInclude,
  });
  if (!event || event.status === "DRAFT")
    throw new DomainError("NOT_FOUND", "ไม่พบงานที่ต้องการ", 404);
  return { ...event, layout: event.publishedLayoutVersion };
}
export async function getAvailability(eventId: string) {
  const event = await getEventById(eventId);
  const [units, pools, ticketTypes] = await Promise.all([
    prisma.bookableUnit.findMany({
      where: { eventId, active: true },
      include: {
        zone: true,
        inventory: { select: { status: true, version: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.capacityPool.findMany({ where: { eventId } }),
    prisma.ticketType.findMany({
      where: { eventId, active: true },
      orderBy: { priceSatang: "asc" },
    }),
  ]);
  return {
    eventId,
    serverNow: new Date().toISOString(),
    eventStatus: event.status,
    units: units.map(({ inventory, ...unit }) => ({
      ...unit,
      status: inventory[0]?.status ?? "BLOCKED",
      inventory: inventory[0] ?? null,
    })),
    pools,
    ticketTypes,
    zones: event.zones,
    layout: event.layout,
  };
}
