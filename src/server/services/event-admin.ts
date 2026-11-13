import "server-only";
import { type Prisma, type EventStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import type { Actor } from "@/server/auth";
import { invariant, DomainError } from "@/server/errors";
import { requireRoles } from "@/server/permissions";
import { idempotent } from "./idempotency";
import {
  createEventInput,
  editEventInput,
  zoneInput,
  unitInput,
  ticketTypeInput,
  inventoryInput,
  poolInput,
  priceEditInput,
  unitActivationInput,
} from "@/shared/catalog";

export const audit = (
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  reason?: string,
  changes?: Prisma.InputJsonValue,
) =>
  tx.auditLog.create({
    data: { actorId, action, entity, entityId, reason, changes },
  });
export const ACTIVE_BOOKING_STATUSES = [
  "PENDING_PAYMENT",
  "PENDING_REVIEW",
  "ACTION_REQUIRED",
  "CONFIRMED",
] as const;
export async function adminEvent(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      zones: { include: { pools: true } },
      units: { include: { inventory: true } },
      ticketTypes: true,
      pools: true,
      layoutTemplate: true,
      publishedLayoutVersion: true,
    },
  });
  if (!event) throw new DomainError("NOT_FOUND", "ไม่พบงาน", 404);
  // Counts let the admin UI show only the actions the server will accept
  // (delete needs zero bookings, returning to draft needs zero active bookings).
  const [bookingCount, activeBookingCount] = await Promise.all([
    prisma.booking.count({ where: { eventId: id } }),
    prisma.booking.count({
      where: { eventId: id, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
    }),
  ]);
  return {
    ...event,
    bookingCount,
    activeBookingCount,
    serverNow: new Date().toISOString(),
  };
}
export async function assertSlugFree(
  tx: Prisma.TransactionClient,
  slug: string,
  exceptEventId?: string,
) {
  const taken = await tx.event.findUnique({
    where: { slug },
    select: { id: true },
  });
  // Checked explicitly: a raw P2002 is retried by transaction() and then reported
  // as a concurrency conflict, which hides the real cause from the operator.
  invariant(
    !taken || taken.id === exceptEventId,
    "SLUG_TAKEN",
    "ชื่อในลิงก์ (slug) นี้ถูกใช้กับงานอื่นแล้ว",
    409,
  );
}
async function assertCodeFree(
  tx: Prisma.TransactionClient,
  kind: "zone" | "unit" | "ticketType",
  eventId: string,
  code: string,
) {
  const where = { eventId_code: { eventId, code } };
  const taken =
    kind === "zone"
      ? await tx.zone.findUnique({ where, select: { id: true } })
      : kind === "unit"
        ? await tx.bookableUnit.findUnique({ where, select: { id: true } })
        : await tx.ticketType.findUnique({ where, select: { id: true } });
  invariant(!taken, "CODE_TAKEN", `รหัส ${code} ถูกใช้ในงานนี้แล้ว`, 409);
}
export async function listAdminEvents(
  page: number,
  pageSize: number,
  q = "",
  status?: EventStatus,
) {
  const where: Prisma.EventWhereInput = {
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(status ? { status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { bookings: true } } },
    }),
    prisma.event.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
export function eventData(input: z.infer<typeof createEventInput>) {
  return {
    ...input,
    posterUrl: input.posterUrl || null,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    saleStartsAt: new Date(input.saleStartsAt),
    saleEndsAt: new Date(input.saleEndsAt),
  };
}
export async function createEvent(
  actor: Actor,
  input: z.infer<typeof createEventInput>,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(actor.id, "event:create", key, input, async (tx) => {
    await assertSlugFree(tx, input.slug);
    const event = await tx.event.create({ data: eventData(input) });
    await tx.layoutTemplate.create({
      data: {
        eventId: event.id,
        name: input.title,
        width: 1000,
        height: 700,
        geometry: { objects: [] },
      },
    });
    await audit(tx, actor.id, "EVENT_CREATE", "Event", event.id);
    return event;
  });
}
export async function editEvent(
  actor: Actor,
  id: string,
  input: z.infer<typeof editEventInput>,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(actor.id, `event:edit:${id}`, key, input, async (tx) => {
    const { version, ...fields } = input;
    const event = await tx.event.findUnique({ where: { id } });
    invariant(
      event && !["CANCELLED", "COMPLETED"].includes(event.status),
      "INVALID_TRANSITION",
      "ไม่สามารถแก้ไขงานในสถานะนี้",
    );
    await assertSlugFree(tx, fields.slug, id);
    const count = await tx.event.updateMany({
      where: { id, version },
      data: { ...eventData(fields), version: { increment: 1 } },
    });
    invariant(
      count.count === 1,
      "VERSION_CONFLICT",
      "มีการแก้ไขงานจากหน้าต่างอื่น กรุณาโหลดใหม่",
    );
    await audit(tx, actor.id, "EVENT_UPDATE", "Event", id);
    return tx.event.findUniqueOrThrow({ where: { id } });
  });
}
export async function changeEventStatus(
  actor: Actor,
  id: string,
  status: EventStatus,
  input: { version: number; reason: string },
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(
    actor.id,
    `event:${status}:${id}`,
    key,
    input,
    async (tx) => {
      const event = await tx.event.findUnique({
        where: { id },
        include: {
          units: { where: { active: true } },
          ticketTypes: { where: { active: true } },
        },
      });
      invariant(event, "NOT_FOUND", "ไม่พบงาน", 404);
      const allowed: Partial<Record<EventStatus, EventStatus[]>> = {
        DRAFT: ["CLOSED"],
        PUBLISHED: ["DRAFT", "CLOSED"],
        CLOSED: ["PUBLISHED"],
        CANCELLED: ["DRAFT", "PUBLISHED", "CLOSED"],
        COMPLETED: ["PUBLISHED", "CLOSED"],
      };
      invariant(
        allowed[status]?.includes(event.status),
        "INVALID_TRANSITION",
        "ไม่สามารถเปลี่ยนสถานะงานนี้",
      );
      if (status === "DRAFT")
        // Check-in only accepts PUBLISHED/CLOSED events, so a draft must not hold
        // live bookings or issued tickets.
        invariant(
          (await tx.booking.count({
            where: {
              eventId: id,
              status: { in: [...ACTIVE_BOOKING_STATUSES] },
            },
          })) === 0,
          "INVALID_TRANSITION",
          "ยังมีรายการจองที่ใช้งานอยู่ ไม่สามารถกลับเป็นฉบับร่าง",
        );
      if (status === "PUBLISHED") {
        invariant(
          event.publishedLayoutVersionId,
          "VALIDATION_ERROR",
          "กรุณาเผยแพร่ผังก่อนเปิดขาย",
          422,
        );
        invariant(
          event.units.length + event.ticketTypes.length > 0,
          "VALIDATION_ERROR",
          "กรุณาเพิ่มหน่วยขายหรือประเภทบัตร",
          422,
        );
        invariant(
          event.saleEndsAt > new Date(),
          "VALIDATION_ERROR",
          "ช่วงขายสิ้นสุดแล้ว",
          422,
        );
        // Units may have been added after the last layout publish. Revalidate the
        // immutable snapshot against current active inventory before opening sales.
        const published = await tx.layoutVersion.findUnique({
          where: { id: event.publishedLayoutVersionId },
        });
        invariant(
          published && published.eventId === event.id,
          "VALIDATION_ERROR",
          "ผังที่เผยแพร่ไม่ตรงกับงาน",
          422,
        );
        const { validateGeometry } = await import("./layout");
        const { layoutInput } = await import("@/shared/catalog");
        await validateGeometry(
          tx,
          id,
          layoutInput.parse({ ...published, version: published.version }),
          true,
        );
        const unitIds = new Set(event.units.map((u) => u.id));
        invariant(
          !event.units.some(
            (u) => u.parentTableId && unitIds.has(u.parentTableId),
          ),
          "VALIDATION_ERROR",
          "ห้ามขายโต๊ะและที่นั่งของโต๊ะเดียวกันพร้อมกัน",
          422,
        );
      }
      if (status === "COMPLETED")
        invariant(
          event.endsAt <= new Date(),
          "INVALID_TRANSITION",
          "งานยังไม่สิ้นสุด",
        );
      const result = await tx.event.updateMany({
        where: { id, version: input.version, status: event.status },
        data: {
          status,
          version: { increment: 1 },
          ...(status === "CANCELLED"
            ? { cancellationReason: input.reason }
            : {}),
        },
      });
      invariant(
        result.count === 1,
        "VERSION_CONFLICT",
        "ข้อมูลเปลี่ยนแปลง กรุณาโหลดใหม่",
      );
      await audit(tx, actor.id, `EVENT_${status}`, "Event", id, input.reason);
      return tx.event.findUniqueOrThrow({ where: { id } });
    },
  );
}
async function configurable(tx: Prisma.TransactionClient, eventId: string) {
  const event = await tx.event.findUnique({ where: { id: eventId } });
  invariant(
    event && event.status === "DRAFT",
    "INVALID_TRANSITION",
    "จัดโครงสร้างหน่วยขายได้เฉพาะร่างงาน",
  );
  const fence = await tx.event.updateMany({
    where: { id: eventId, version: event.version, status: "DRAFT" },
    data: { version: { increment: 1 } },
  });
  invariant(
    fence.count === 1,
    "VERSION_CONFLICT",
    "งานเปลี่ยนแปลง กรุณาโหลดใหม่",
  );
  return event;
}
export async function createZone(
  actor: Actor,
  eventId: string,
  input: z.infer<typeof zoneInput>,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(
    actor.id,
    `zone:create:${eventId}`,
    key,
    input,
    async (tx) => {
      await configurable(tx, eventId);
      await assertCodeFree(tx, "zone", eventId, input.code);
      const zone = await tx.zone.create({
        data: { ...input, eventId, capacity: input.capacity ?? 0 },
      });
      if (input.sellingMode === "GENERAL_ADMISSION") {
        invariant(
          input.capacity,
          "VALIDATION_ERROR",
          "กรุณากำหนดความจุโซน",
          422,
        );
        await tx.capacityPool.create({
          data: {
            eventId,
            zoneId: zone.id,
            code: input.code,
            capacity: input.capacity,
            available: input.capacity,
          },
        });
      }
      await audit(tx, actor.id, "ZONE_CREATE", "Zone", zone.id);
      return tx.zone.findUniqueOrThrow({
        where: { id: zone.id },
        include: { pools: true },
      });
    },
  );
}
export async function createUnit(
  actor: Actor,
  eventId: string,
  input: z.infer<typeof unitInput>,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(
    actor.id,
    `unit:create:${eventId}`,
    key,
    input,
    async (tx) => {
      await configurable(tx, eventId);
      await assertCodeFree(tx, "unit", eventId, input.code);
      const zone = await tx.zone.findFirst({
        where: { id: input.zoneId, eventId, sellingMode: input.sellingMode },
      });
      invariant(zone, "VALIDATION_ERROR", "ประเภทหน่วยขายไม่ตรงกับโซน", 422);
      if (input.parentUnitId) {
        const parent = await tx.bookableUnit.findFirst({
          where: {
            id: input.parentUnitId,
            eventId,
            sellingMode: "TABLE",
            active: false,
          },
        });
        invariant(
          parent && input.sellingMode === "SEAT",
          "VALIDATION_ERROR",
          "โต๊ะต้นทางต้องหยุดขายก่อนขายที่นั่งแยก",
          422,
        );
      }
      const { parentUnitId, ...fields } = input;
      const unit = await tx.bookableUnit.create({
        data: { ...fields, eventId, parentTableId: parentUnitId ?? null },
      });
      await tx.unitInventory.create({ data: { eventId, unitId: unit.id } });
      await audit(tx, actor.id, "UNIT_CREATE", "BookableUnit", unit.id);
      return unit;
    },
  );
}
export async function createTicketType(
  actor: Actor,
  eventId: string,
  input: z.infer<typeof ticketTypeInput>,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(
    actor.id,
    `ticket-type:create:${eventId}`,
    key,
    input,
    async (tx) => {
      await configurable(tx, eventId);
      await assertCodeFree(tx, "ticketType", eventId, input.code);
      const pool = await tx.capacityPool.findFirst({
        where: { id: input.poolId, eventId, zoneId: input.zoneId },
        include: { zone: true },
      });
      invariant(
        pool?.zone.sellingMode === "GENERAL_ADMISSION",
        "VALIDATION_ERROR",
        "ต้องเลือกโควตาของโซนบัตรยืนเดียวกัน",
        422,
      );
      const type = await tx.ticketType.create({
        data: {
          ...input,
          eventId,
          saleStartsAt: new Date(input.saleStartsAt),
          saleEndsAt: new Date(input.saleEndsAt),
        },
      });
      await audit(tx, actor.id, "TICKET_TYPE_CREATE", "TicketType", type.id);
      return type;
    },
  );
}
export async function setUnitInventory(
  actor: Actor,
  eventId: string,
  unitId: string,
  input: z.infer<typeof inventoryInput>,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(actor.id, `inventory:${unitId}`, key, input, async (tx) => {
    const result = await tx.unitInventory.updateMany({
      where: {
        eventId,
        unitId,
        version: input.version,
        status: { in: ["AVAILABLE", "BLOCKED"] },
      },
      data: { status: input.status, version: { increment: 1 } },
    });
    invariant(
      result.count === 1,
      "INVENTORY_UNAVAILABLE",
      "หน่วยนี้ถูกจองหรือข้อมูลเปลี่ยนแปลงแล้ว",
    );
    await audit(
      tx,
      actor.id,
      "INVENTORY_UPDATE",
      "BookableUnit",
      unitId,
      input.reason,
    );
    return tx.unitInventory.findUniqueOrThrow({
      where: { eventId_unitId: { eventId, unitId } },
    });
  });
}
export async function setPoolCapacity(
  actor: Actor,
  eventId: string,
  poolId: string,
  input: z.infer<typeof poolInput>,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(actor.id, `pool:${poolId}`, key, input, async (tx) => {
    const pool = await tx.capacityPool.findFirst({
      where: { id: poolId, eventId },
    });
    invariant(pool, "NOT_FOUND", "ไม่พบโควตา", 404);
    const delta = input.capacity - pool.capacity;
    invariant(
      pool.available + delta >= 0,
      "INVENTORY_UNAVAILABLE",
      "ความจุใหม่ต่ำกว่าสิทธิ์ที่ใช้อยู่",
    );
    const result = await tx.capacityPool.updateMany({
      where: { id: poolId, version: input.version, available: { gte: -delta } },
      data: {
        capacity: input.capacity,
        available: { increment: delta },
        version: { increment: 1 },
      },
    });
    invariant(
      result.count === 1,
      "VERSION_CONFLICT",
      "โควตาเปลี่ยนแปลง กรุณาโหลดใหม่",
    );
    // Each zone owns one shared pool; all price tiers refer to it.
    await tx.zone.update({
      where: { id: pool.zoneId },
      data: { capacity: input.capacity },
    });
    await audit(
      tx,
      actor.id,
      "CAPACITY_UPDATE",
      "CapacityPool",
      poolId,
      input.reason,
    );
    return tx.capacityPool.findUniqueOrThrow({ where: { id: poolId } });
  });
}

export async function editPrice(
  actor: Actor,
  eventId: string,
  id: string,
  kind: "unit" | "ticketType",
  input: z.infer<typeof priceEditInput>,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(actor.id, `${kind}:price:${id}`, key, input, async (tx) => {
    const fenced = await tx.event.updateMany({
      where: {
        id: eventId,
        version: input.eventVersion,
        status: { in: ["DRAFT", "PUBLISHED", "CLOSED"] },
      },
      data: { version: { increment: 1 } },
    });
    invariant(
      fenced.count === 1,
      "VERSION_CONFLICT",
      "งานเปลี่ยนแปลง กรุณาโหลดใหม่",
    );
    const result =
      kind === "unit"
        ? await tx.bookableUnit.updateMany({
            where: { id, eventId },
            data: {
              name: input.name,
              priceSatang: input.priceSatang,
              ...(input.admissionCount !== undefined
                ? { admissionCount: input.admissionCount }
                : {}),
            },
          })
        : await tx.ticketType.updateMany({
            where: { id, eventId },
            data: { name: input.name, priceSatang: input.priceSatang },
          });
    invariant(result.count === 1, "NOT_FOUND", "ไม่พบหน่วยขาย", 404);
    await audit(
      tx,
      actor.id,
      "PRICE_UPDATE",
      kind === "unit" ? "BookableUnit" : "TicketType",
      id,
      input.reason,
      {
        priceSatang: input.priceSatang,
        ...(input.admissionCount !== undefined
          ? { admissionCount: input.admissionCount }
          : {}),
      },
    );
    return {
      id,
      name: input.name,
      priceSatang: input.priceSatang,
      ...(input.admissionCount !== undefined
        ? { admissionCount: input.admissionCount }
        : {}),
      eventVersion: input.eventVersion + 1,
    };
  });
}

export async function setUnitActive(
  actor: Actor,
  eventId: string,
  unitId: string,
  input: z.infer<typeof unitActivationInput>,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(
    actor.id,
    `unit:active:${unitId}`,
    key,
    input,
    async (tx) => {
      const event = await tx.event.findUnique({ where: { id: eventId } });
      invariant(
        event?.status === "DRAFT" && event.version === input.eventVersion,
        "VERSION_CONFLICT",
        "ปรับหน่วยขายได้เฉพาะร่างงานล่าสุด",
      );
      const unit = await tx.bookableUnit.findFirst({
        where: { id: unitId, eventId },
        include: { parentTable: true, seats: true },
      });
      invariant(unit, "NOT_FOUND", "ไม่พบหน่วยขาย", 404);
      invariant(
        (await tx.bookingItem.count({ where: { unitId } })) === 0,
        "INVALID_TRANSITION",
        "หน่วยที่มีประวัติการจองต้องรักษาข้อมูลเดิม",
      );
      if (input.active)
        invariant(
          !unit.parentTable?.active && !unit.seats.some((s) => s.active),
          "INVALID_TRANSITION",
          "ห้ามเปิดขายโต๊ะและที่นั่งย่อยพร้อมกัน",
        );
      const fence = await tx.event.updateMany({
        where: { id: eventId, version: input.eventVersion, status: "DRAFT" },
        data: { version: { increment: 1 } },
      });
      invariant(
        fence.count === 1,
        "VERSION_CONFLICT",
        "งานเปลี่ยนแปลง กรุณาโหลดใหม่",
      );
      const updated = await tx.bookableUnit.update({
        where: { id: unitId },
        data: { active: input.active },
      });
      await audit(
        tx,
        actor.id,
        "UNIT_ACTIVE_UPDATE",
        "BookableUnit",
        unitId,
        input.reason,
        { active: input.active },
      );
      return updated;
    },
  );
}
