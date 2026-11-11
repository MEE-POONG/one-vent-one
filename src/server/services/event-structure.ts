import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Actor } from "@/server/auth";
import { DomainError, invariant } from "@/server/errors";
import { requireRoles } from "@/server/permissions";
import { idempotent } from "./idempotency";
import type { Tx } from "./transaction";
import { assertSlugFree, audit, eventData } from "./event-admin";
import {
  type LayoutGeometry,
  createEventInput,
  structureDeleteInput,
  ticketTypeEditInput,
  versionInput,
  zoneEditInput,
} from "@/shared/catalog";

// Deletes here are hard deletes, so every one of them first proves that no booking,
// payment or ticket history refers to the record. Anything with history is retired
// through close/cancel/block instead (docs/API_CONTRACT.md).

const EDITABLE = ["DRAFT", "PUBLISHED", "CLOSED"] as const;

/** Bumps the event version so concurrent edits and sales serialize behind this change. */
async function fenceEvent(
  tx: Tx,
  eventId: string,
  eventVersion: number,
  statuses: readonly ("DRAFT" | "PUBLISHED" | "CLOSED")[],
) {
  const fence = await tx.event.updateMany({
    where: {
      id: eventId,
      version: eventVersion,
      status: { in: [...statuses] },
    },
    data: { version: { increment: 1 } },
  });
  if (fence.count === 1) return;
  const event = await tx.event.findUnique({ where: { id: eventId } });
  invariant(event, "NOT_FOUND", "ไม่พบงาน", 404);
  invariant(
    (statuses as readonly string[]).includes(event.status),
    "INVALID_TRANSITION",
    statuses.length === 1
      ? "แก้ไขหรือลบโครงสร้างได้เฉพาะงานฉบับร่าง"
      : "ไม่สามารถแก้ไขงานในสถานะนี้",
  );
  throw new DomainError(
    "VERSION_CONFLICT",
    "งานเปลี่ยนแปลงจากหน้าต่างอื่น กรุณาโหลดใหม่",
    409,
  );
}

/**
 * Keeps the draft layout consistent with deleted inventory. Objects that must be
 * bound (zone/table/seat) are removed; decorative objects only lose the zone link.
 */
async function pruneDraftLayout(
  tx: Tx,
  eventId: string,
  target: { unitId?: string; zoneId?: string },
) {
  const draft = await tx.layoutTemplate.findUnique({ where: { eventId } });
  if (!draft) return 0;
  const geometry = draft.geometry as unknown as LayoutGeometry | null;
  const objects = geometry?.objects ?? [];
  let removed = 0;
  const next = objects.flatMap((o) => {
    if (target.unitId && o.unitId === target.unitId) {
      removed++;
      return [];
    }
    if (target.zoneId && o.zoneId === target.zoneId) {
      if (["zone", "table", "seat"].includes(o.type)) {
        removed++;
        return [];
      }
      return [{ ...o, zoneId: null }];
    }
    return [o];
  });
  if (removed || next.some((o, i) => o !== objects[i]))
    await tx.layoutTemplate.update({
      where: { id: draft.id },
      data: {
        geometry: { objects: next } as Prisma.InputJsonValue,
        revision: { increment: 1 },
      },
    });
  return removed;
}

export async function deleteEvent(
  actor: Actor,
  id: string,
  input: z.infer<typeof versionInput>,
  key: string,
) {
  requireRoles(actor, "EVENT_MANAGER");
  return idempotent(actor.id, `event:delete:${id}`, key, input, async (tx) => {
    const event = await tx.event.findUnique({ where: { id } });
    invariant(event, "NOT_FOUND", "ไม่พบงาน", 404);
    invariant(
      ["DRAFT", "CLOSED", "CANCELLED"].includes(event.status),
      "INVALID_TRANSITION",
      "ปิดการขายก่อนลบงาน",
    );
    invariant(
      (await tx.booking.count({ where: { eventId: id } })) === 0,
      "INVALID_TRANSITION",
      "งานที่มีประวัติการจองลบไม่ได้ เพื่อเก็บประวัติธุรกรรม ให้ใช้ยกเลิกงานแทน",
    );
    const fence = await tx.event.updateMany({
      where: { id, version: input.version, status: event.status },
      data: { version: { increment: 1 }, publishedLayoutVersionId: null },
    });
    invariant(
      fence.count === 1,
      "VERSION_CONFLICT",
      "งานเปลี่ยนแปลงจากหน้าต่างอื่น กรุณาโหลดใหม่",
    );
    // Children first: relations use NoAction, so nothing cascades on its own.
    const where = { eventId: id };
    await tx.unitInventory.deleteMany({ where });
    await tx.ticketType.deleteMany({ where });
    await tx.capacityPool.deleteMany({ where });
    await tx.bookableUnit.updateMany({ where, data: { parentTableId: null } });
    await tx.bookableUnit.deleteMany({ where });
    await tx.zone.deleteMany({ where });
    await tx.layoutVersion.deleteMany({ where });
    await tx.layoutTemplate.deleteMany({ where });
    await tx.staffEventAssignment.deleteMany({ where });
    await tx.checkInLog.deleteMany({ where });
    await tx.event.delete({ where: { id } });
    await audit(tx, actor.id, "EVENT_DELETE", "Event", id, input.reason, {
      title: event.title,
      slug: event.slug,
      status: event.status,
    });
    return { id, deleted: true };
  });
}

/** A Mongo ObjectId-shaped id, pre-generated so related rows can be bulk inserted. */
const newId = () =>
  Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, "0") + randomBytes(8).toString("hex");

export async function duplicateEvent(
  actor: Actor,
  sourceId: string,
  input: z.infer<typeof createEventInput>,
  key: string,
) {
  requireRoles(actor, "EVENT_MANAGER");
  return idempotent(
    actor.id,
    `event:duplicate:${sourceId}`,
    key,
    input,
    async (tx) => {
      const source = await tx.event.findUnique({
        where: { id: sourceId },
        include: {
          zones: true,
          pools: true,
          units: true,
          ticketTypes: true,
          layoutTemplate: true,
        },
      });
      invariant(source, "NOT_FOUND", "ไม่พบงานต้นฉบับ", 404);
      await assertSlugFree(tx, input.slug);
      const event = await tx.event.create({ data: eventData(input) });
      const eventId = event.id;
      const zoneIds = new Map(source.zones.map((z) => [z.id, newId()]));
      const poolIds = new Map(source.pools.map((p) => [p.id, newId()]));
      const unitIds = new Map(source.units.map((u) => [u.id, newId()]));
      const mapped = (map: Map<string, string>, id: string) => {
        const value = map.get(id);
        invariant(value, "VALIDATION_ERROR", "ข้อมูลงานต้นฉบับไม่สมบูรณ์", 422);
        return value;
      };
      if (source.zones.length)
        await tx.zone.createMany({
          data: source.zones.map((z) => ({
            id: mapped(zoneIds, z.id),
            eventId,
            code: z.code,
            name: z.name,
            sellingMode: z.sellingMode,
            capacity: z.capacity,
            color: z.color,
          })),
        });
      if (source.pools.length)
        await tx.capacityPool.createMany({
          data: source.pools.map((p) => ({
            id: mapped(poolIds, p.id),
            eventId,
            zoneId: mapped(zoneIds, p.zoneId),
            code: p.code,
            capacity: p.capacity,
            available: p.capacity,
          })),
        });
      if (source.units.length) {
        await tx.bookableUnit.createMany({
          data: source.units.map((u) => ({
            id: mapped(unitIds, u.id),
            eventId,
            zoneId: mapped(zoneIds, u.zoneId),
            code: u.code,
            name: u.name,
            sellingMode: u.sellingMode,
            parentTableId: u.parentTableId
              ? mapped(unitIds, u.parentTableId)
              : null,
            admissionCount: u.admissionCount,
            priceSatang: u.priceSatang,
            active: u.active,
            metadata: (u.metadata ?? undefined) as
              Prisma.InputJsonValue | undefined,
          })),
        });
        // New show, fresh stock: blocks and holds of the source are not copied.
        await tx.unitInventory.createMany({
          data: source.units.map((u) => ({
            eventId,
            unitId: mapped(unitIds, u.id),
          })),
        });
      }
      // Price tiers keep their position relative to the show (e.g. Early Bird ends
      // 7 days before doors) by shifting with the start time.
      const shift = Date.parse(input.startsAt) - source.startsAt.getTime();
      if (source.ticketTypes.length)
        await tx.ticketType.createMany({
          data: source.ticketTypes.map((t) => ({
            eventId,
            zoneId: mapped(zoneIds, t.zoneId),
            poolId: mapped(poolIds, t.poolId),
            code: t.code,
            name: t.name,
            priceSatang: t.priceSatang,
            saleStartsAt: new Date(t.saleStartsAt.getTime() + shift),
            saleEndsAt: new Date(t.saleEndsAt.getTime() + shift),
            active: t.active,
          })),
        });
      const geometry = source.layoutTemplate?.geometry as unknown as
        LayoutGeometry | undefined;
      await tx.layoutTemplate.create({
        data: {
          eventId,
          name: input.title,
          width: source.layoutTemplate?.width ?? 1000,
          height: source.layoutTemplate?.height ?? 700,
          geometry: {
            objects: (geometry?.objects ?? []).map((o) => ({
              ...o,
              zoneId: o.zoneId ? (zoneIds.get(o.zoneId) ?? null) : o.zoneId,
              unitId: o.unitId ? (unitIds.get(o.unitId) ?? null) : o.unitId,
            })),
          } as Prisma.InputJsonValue,
        },
      });
      await audit(
        tx,
        actor.id,
        "EVENT_DUPLICATE",
        "Event",
        eventId,
        undefined,
        { sourceEventId: sourceId },
      );
      return event;
    },
  );
}

export async function updateZone(
  actor: Actor,
  eventId: string,
  zoneId: string,
  input: z.infer<typeof zoneEditInput>,
  key: string,
) {
  requireRoles(actor, "EVENT_MANAGER");
  return idempotent(actor.id, `zone:edit:${zoneId}`, key, input, async (tx) => {
    // Name and colour are display-only; booking snapshots keep their own copy.
    await fenceEvent(tx, eventId, input.eventVersion, EDITABLE);
    const result = await tx.zone.updateMany({
      where: { id: zoneId, eventId },
      data: { name: input.name, color: input.color },
    });
    invariant(result.count === 1, "NOT_FOUND", "ไม่พบโซน", 404);
    await audit(tx, actor.id, "ZONE_UPDATE", "Zone", zoneId, undefined, {
      name: input.name,
      color: input.color,
    });
    return tx.zone.findUniqueOrThrow({ where: { id: zoneId } });
  });
}

export async function deleteZone(
  actor: Actor,
  eventId: string,
  zoneId: string,
  input: z.infer<typeof structureDeleteInput>,
  key: string,
) {
  requireRoles(actor, "EVENT_MANAGER");
  return idempotent(
    actor.id,
    `zone:delete:${zoneId}`,
    key,
    input,
    async (tx) => {
      await fenceEvent(tx, eventId, input.eventVersion, ["DRAFT"]);
      const zone = await tx.zone.findFirst({
        where: { id: zoneId, eventId },
        include: {
          _count: { select: { units: true, ticketTypes: true } },
          pools: { select: { id: true } },
        },
      });
      invariant(zone, "NOT_FOUND", "ไม่พบโซน", 404);
      invariant(
        zone._count.units === 0 && zone._count.ticketTypes === 0,
        "INVALID_TRANSITION",
        "ลบหน่วยขายและประเภทบัตรในโซนนี้ก่อน",
      );
      const poolIds = zone.pools.map((p) => p.id);
      invariant(
        (await tx.capacityAllocation.count({
          where: { poolId: { in: poolIds } },
        })) === 0,
        "INVALID_TRANSITION",
        "โควตาของโซนนี้มีประวัติการจอง",
      );
      await tx.capacityPool.deleteMany({ where: { id: { in: poolIds } } });
      await tx.zone.delete({ where: { id: zoneId } });
      const layoutObjectsRemoved = await pruneDraftLayout(tx, eventId, {
        zoneId,
      });
      await audit(tx, actor.id, "ZONE_DELETE", "Zone", zoneId, undefined, {
        code: zone.code,
        name: zone.name,
      });
      return { id: zoneId, deleted: true, layoutObjectsRemoved };
    },
  );
}

export async function deleteUnit(
  actor: Actor,
  eventId: string,
  unitId: string,
  input: z.infer<typeof structureDeleteInput>,
  key: string,
) {
  requireRoles(actor, "EVENT_MANAGER");
  return idempotent(
    actor.id,
    `unit:delete:${unitId}`,
    key,
    input,
    async (tx) => {
      await fenceEvent(tx, eventId, input.eventVersion, ["DRAFT"]);
      const unit = await tx.bookableUnit.findFirst({
        where: { id: unitId, eventId },
        include: { _count: { select: { seats: true, bookingItems: true } } },
      });
      invariant(unit, "NOT_FOUND", "ไม่พบหน่วยขาย", 404);
      invariant(
        unit._count.bookingItems === 0,
        "INVALID_TRANSITION",
        "หน่วยที่มีประวัติการจองลบไม่ได้ ให้ใช้ปิดหน่วยหรือนำออกจากการขายแทน",
      );
      invariant(
        unit._count.seats === 0,
        "INVALID_TRANSITION",
        "ลบที่นั่งย่อยของโต๊ะนี้ก่อน",
      );
      await tx.unitInventory.deleteMany({ where: { eventId, unitId } });
      await tx.bookableUnit.delete({ where: { id: unitId } });
      const layoutObjectsRemoved = await pruneDraftLayout(tx, eventId, {
        unitId,
      });
      await audit(
        tx,
        actor.id,
        "UNIT_DELETE",
        "BookableUnit",
        unitId,
        undefined,
        { code: unit.code, name: unit.name },
      );
      return { id: unitId, deleted: true, layoutObjectsRemoved };
    },
  );
}

export async function updateTicketType(
  actor: Actor,
  eventId: string,
  ticketTypeId: string,
  input: z.infer<typeof ticketTypeEditInput>,
  key: string,
) {
  requireRoles(actor, "EVENT_MANAGER");
  return idempotent(
    actor.id,
    `ticket-type:edit:${ticketTypeId}`,
    key,
    input,
    async (tx) => {
      // Allowed while on sale: ending an Early Bird tier early only affects new bookings.
      await fenceEvent(tx, eventId, input.eventVersion, EDITABLE);
      const data = {
        saleStartsAt: new Date(input.saleStartsAt),
        saleEndsAt: new Date(input.saleEndsAt),
        active: input.active,
      };
      const result = await tx.ticketType.updateMany({
        where: { id: ticketTypeId, eventId },
        data,
      });
      invariant(result.count === 1, "NOT_FOUND", "ไม่พบประเภทบัตร", 404);
      await audit(
        tx,
        actor.id,
        "TICKET_TYPE_UPDATE",
        "TicketType",
        ticketTypeId,
        input.reason,
        {
          saleStartsAt: input.saleStartsAt,
          saleEndsAt: input.saleEndsAt,
          active: input.active,
        },
      );
      return tx.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    },
  );
}

export async function deleteTicketType(
  actor: Actor,
  eventId: string,
  ticketTypeId: string,
  input: z.infer<typeof structureDeleteInput>,
  key: string,
) {
  requireRoles(actor, "EVENT_MANAGER");
  return idempotent(
    actor.id,
    `ticket-type:delete:${ticketTypeId}`,
    key,
    input,
    async (tx) => {
      await fenceEvent(tx, eventId, input.eventVersion, ["DRAFT"]);
      const type = await tx.ticketType.findFirst({
        where: { id: ticketTypeId, eventId },
        include: { _count: { select: { bookingItems: true } } },
      });
      invariant(type, "NOT_FOUND", "ไม่พบประเภทบัตร", 404);
      invariant(
        type._count.bookingItems === 0,
        "INVALID_TRANSITION",
        "ประเภทบัตรที่มีประวัติการจองลบไม่ได้ ให้ใช้ปิดการขายประเภทนี้แทน",
      );
      await tx.ticketType.delete({ where: { id: ticketTypeId } });
      await audit(
        tx,
        actor.id,
        "TICKET_TYPE_DELETE",
        "TicketType",
        ticketTypeId,
        undefined,
        { code: type.code, name: type.name },
      );
      return { id: ticketTypeId, deleted: true };
    },
  );
}
