import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma, BookingStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import type { Actor } from "@/server/auth";
import { DomainError, invariant, notFound } from "@/server/errors";
import { hasRole, requireRoles } from "@/server/permissions";
import type { ActionInput, CreateBookingInput } from "@/shared/booking";
import { idempotent } from "./idempotency";
import { transaction, type Tx } from "./transaction";
import { moveInventory } from "./inventory";

export const bookingInclude = {
  items: true,
  payments: { orderBy: { submittedAt: "desc" as const } },
  refunds: true,
  event: {
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      endsAt: true,
      venue: true,
      status: true,
    },
  },
} satisfies Prisma.BookingInclude;

export async function bookingResult(tx: Tx, id: string) {
  const booking = await tx.booking.findUnique({
    where: { id },
    include: bookingInclude,
  });
  if (!booking) throw notFound();
  const auditTimeline = await tx.auditLog.findMany({
    where: { entity: "Booking", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { action: true, reason: true, createdAt: true },
  });
  return { ...booking, auditTimeline, serverNow: new Date().toISOString() };
}

export async function ownedBooking(
  tx: Tx,
  actor: Actor,
  id: string,
  staffAllowed = false,
) {
  const booking = await tx.booking.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!booking) throw notFound();
  if (
    booking.userId !== actor.id &&
    !(staffAllowed && hasRole(actor, "ADMIN"))
  )
    throw new DomainError("FORBIDDEN", "คุณไม่มีสิทธิ์เข้าถึงรายการนี้", 403);
  return booking;
}

export async function createBooking(
  actor: Actor,
  input: CreateBookingInput,
  key: string,
) {
  await expireUnpaidHolds(input.eventId);
  return idempotent(actor.id, "booking.create", key, input, async (tx) => {
    const now = new Date();
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    invariant(
      event &&
        event.status === "PUBLISHED" &&
        event.saleStartsAt <= now &&
        event.saleEndsAt > now &&
        event.endsAt > now,
      "EVENT_NOT_ON_SALE",
      "งานนี้ยังไม่เปิดขายหรือปิดการขายแล้ว",
    );
    invariant(
      event.publishedLayoutVersionId,
      "EVENT_NOT_ON_SALE",
      "งานนี้ยังไม่เผยแพร่ผัง",
    );
    // Write fence serializes the sale against close/cancel and price/layout edits.
    const saleFence = await tx.event.updateMany({
      where: { id: event.id, status: "PUBLISHED", version: event.version },
      data: { version: { increment: 1 } },
    });
    invariant(
      saleFence.count === 1,
      "EVENT_NOT_ON_SALE",
      "ข้อมูลงานเปลี่ยนแปลง กรุณาลองใหม่",
    );
    const business = await tx.businessProfile.findUnique({
      where: { key: "primary" },
    });
    invariant(business, "SERVICE_UNAVAILABLE", "ยังไม่ได้ตั้งค่าธุรกิจ", 503);
    const seen = new Set<string>();
    const priced: Prisma.BookingItemUncheckedCreateWithoutBookingInput[] = [];
    let totalSatang = 0;
    let totalAdmissions = 0;
    for (const requested of input.items) {
      const selection = requested.unitId || requested.ticketTypeId!;
      invariant(
        !seen.has(selection),
        "VALIDATION_ERROR",
        "มีรายการซ้ำในคำขอ",
        422,
      );
      seen.add(selection);
      if (requested.unitId) {
        invariant(
          requested.quantity === 1,
          "VALIDATION_ERROR",
          "โต๊ะหรือที่นั่งแต่ละหน่วยต้องมีจำนวน 1",
          422,
        );
        const unit = await tx.bookableUnit.findUnique({
          where: { id: requested.unitId },
          include: {
            zone: true,
            parentTable: true,
            seats: { where: { active: true } },
          },
        });
        invariant(
          unit &&
            unit.eventId === event.id &&
            unit.active &&
            unit.zone.eventId === event.id &&
            unit.zone.sellingMode === unit.sellingMode &&
            ["TABLE", "SEAT"].includes(unit.sellingMode),
          "VALIDATION_ERROR",
          "หน่วยขายไม่อยู่ในงานหรือโซนนี้",
          422,
        );
        invariant(
          !(unit.sellingMode === "TABLE" && unit.seats.length) &&
            !(unit.sellingMode === "SEAT" && unit.parentTable?.active),
          "VALIDATION_ERROR",
          "ไม่สามารถขายโต๊ะพร้อมที่นั่งย่อยได้",
          422,
        );
        invariant(
          unit.priceSatang > 0 &&
            (unit.sellingMode === "SEAT"
              ? unit.admissionCount === 1
              : unit.admissionCount > 0),
          "VALIDATION_ERROR",
          "ราคาและจำนวนสิทธิ์ของหน่วยขายไม่ถูกต้อง",
          422,
        );
        totalSatang += unit.priceSatang;
        totalAdmissions += unit.admissionCount;
        priced.push({
          sellingMode: unit.sellingMode,
          unitId: unit.id,
          quantity: 1,
          admissionCount: unit.admissionCount,
          unitPriceSatang: unit.priceSatang,
          subtotalSatang: unit.priceSatang,
          snapshot: {
            eventTitle: event.title,
            zoneName: unit.zone.name,
            unitName: unit.name,
            unitCode: unit.code,
            admissionCount: unit.admissionCount,
            layoutVersionId: event.publishedLayoutVersionId,
          },
        });
      } else {
        const type = await tx.ticketType.findUnique({
          where: { id: requested.ticketTypeId },
          include: { zone: true, pool: true },
        });
        invariant(
          type &&
            type.eventId === event.id &&
            type.active &&
            type.saleStartsAt <= now &&
            type.saleEndsAt > now &&
            type.zone.eventId === event.id &&
            type.zone.sellingMode === "GENERAL_ADMISSION" &&
            type.pool.eventId === event.id &&
            type.pool.zoneId === type.zoneId &&
            type.priceSatang > 0,
          "EVENT_NOT_ON_SALE",
          "ประเภทบัตรนี้ไม่เปิดขาย",
        );
        const subtotal = type.priceSatang * requested.quantity;
        totalSatang += subtotal;
        totalAdmissions += requested.quantity;
        priced.push({
          sellingMode: "GENERAL_ADMISSION",
          ticketTypeId: type.id,
          poolId: type.poolId,
          quantity: requested.quantity,
          admissionCount: requested.quantity,
          unitPriceSatang: type.priceSatang,
          subtotalSatang: subtotal,
          snapshot: {
            eventTitle: event.title,
            zoneName: type.zone.name,
            ticketTypeName: type.name,
            unitName: type.name,
            admissionCount: requested.quantity,
            layoutVersionId: event.publishedLayoutVersionId,
          },
        });
      }
    }
    const configuredMaximum = Number(
      (business.bookingPolicy as Record<string, unknown>).maxAdmissions ?? 20,
    );
    const maxAdmissions =
      Number.isInteger(configuredMaximum) && configuredMaximum > 0
        ? Math.min(configuredMaximum, 100)
        : 20;
    invariant(
      totalAdmissions <= maxAdmissions &&
        totalSatang <= 100_000_000 &&
        Number.isSafeInteger(totalSatang),
      "VALIDATION_ERROR",
      "รายการจองเกินจำนวนหรือวงเงินที่อนุญาต",
      422,
    );
    const holdExpiresAt = new Date(
      now.getTime() + business.holdMinutes * 60_000,
    );
    const booking = await tx.booking.create({
      data: {
        bookingNumber: `OVO-${randomBytes(7).toString("hex").toUpperCase()}`,
        userId: actor.id,
        eventId: event.id,
        totalSatang,
        totalAdmissions,
        holdExpiresAt,
        layoutVersionId: event.publishedLayoutVersionId,
        snapshot: {
          eventTitle: event.title,
          venue: event.venue,
          startsAt: event.startsAt.toISOString(),
          policy: business.bookingPolicy,
          businessName: business.displayName,
          paymentInstructions: business.paymentInstructions,
          layoutVersionId: event.publishedLayoutVersionId,
        },
        items: { create: priced },
      },
      include: { items: true },
    });
    for (const item of booking.items) {
      if (item.unitId) {
        const claimed = await tx.unitInventory.updateMany({
          where: {
            eventId: event.id,
            unitId: item.unitId,
            status: "AVAILABLE",
          },
          data: {
            status: "HELD",
            holdBookingId: booking.id,
            holdExpiresAt,
            version: { increment: 1 },
          },
        });
        invariant(
          claimed.count === 1,
          "INVENTORY_UNAVAILABLE",
          "โต๊ะหรือที่นั่งถูกจองแล้ว กรุณาเลือกใหม่",
        );
      } else {
        const claimed = await tx.capacityPool.updateMany({
          where: {
            id: item.poolId!,
            eventId: event.id,
            available: { gte: item.quantity },
          },
          data: {
            available: { decrement: item.quantity },
            held: { increment: item.quantity },
            version: { increment: 1 },
          },
        });
        invariant(
          claimed.count === 1,
          "INVENTORY_UNAVAILABLE",
          "จำนวนบัตรคงเหลือไม่เพียงพอ",
        );
        await tx.capacityAllocation.create({
          data: {
            bookingItemId: item.id,
            poolId: item.poolId!,
            quantity: item.quantity,
          },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "BOOKING_CREATED",
        entity: "Booking",
        entityId: booking.id,
        changes: { totalSatang, totalAdmissions },
      },
    });
    return bookingResult(tx, booking.id);
  });
}

export async function expireBooking(tx: Tx, id: string, now = new Date()) {
  const booking = await tx.booking.findUnique({
    where: { id },
    include: { items: true },
  });
  if (
    !booking ||
    booking.status !== "PENDING_PAYMENT" ||
    booking.holdExpiresAt > now
  )
    return false;
  const expired = await tx.booking.updateMany({
    where: {
      id,
      status: "PENDING_PAYMENT",
      version: booking.version,
      holdExpiresAt: { lte: now },
    },
    data: {
      status: "EXPIRED",
      version: { increment: 1 },
      reason: "หมดเวลาชำระเงิน",
    },
  });
  if (!expired.count) return false;
  await moveInventory(tx, booking, "HELD", "RELEASED");
  await tx.auditLog.create({
    data: {
      action: "BOOKING_EXPIRED",
      entity: "Booking",
      entityId: id,
      reason: "หมดเวลาชำระเงินตามเวลาของเซิร์ฟเวอร์",
    },
  });
  return true;
}

export async function expireUnpaidHolds(eventId?: string) {
  const rows = await prisma.booking.findMany({
    where: {
      status: "PENDING_PAYMENT",
      holdExpiresAt: { lte: new Date() },
      ...(eventId ? { eventId } : {}),
    },
    select: { id: true },
    take: 100,
    orderBy: { holdExpiresAt: "asc" },
  });
  let expired = 0;
  for (const row of rows)
    if (await transaction((tx) => expireBooking(tx, row.id))) expired++;
  return {
    examined: rows.length,
    expired,
    more: rows.length === 100,
    serverNow: new Date().toISOString(),
  };
}

export async function getBooking(actor: Actor, id: string) {
  await ownedBooking(prisma, actor, id, true);
  await transaction((tx) => expireBooking(tx, id));
  return bookingResult(prisma, id);
}

export async function listBookings(
  actor: Actor,
  { page, pageSize, skip }: { page: number; pageSize: number; skip: number },
  admin = false,
  filters: { status?: BookingStatus; eventId?: string; q?: string } = {},
) {
  if (admin) requireRoles(actor, "ADMIN");
  const where: Prisma.BookingWhereInput = {
    ...(admin ? {} : { userId: actor.id }),
    ...(filters.status && { status: filters.status }),
    ...(filters.eventId && { eventId: filters.eventId }),
    ...(filters.q && {
      bookingNumber: { contains: filters.q, mode: "insensitive" },
    }),
  };
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.booking.count({ where }),
  ]);
  return {
    bookings,
    total,
    page,
    pageSize,
    serverNow: new Date().toISOString(),
  };
}

export async function cancelBooking(
  actor: Actor,
  id: string,
  input: ActionInput,
  key: string,
  options: { eventCancellation?: boolean; reject?: boolean } = {},
) {
  const staff = hasRole(actor, "ADMIN");
  if (options.eventCancellation) requireRoles(actor, "ADMIN");
  if (options.reject) requireRoles(actor, "ADMIN");
  return idempotent(
    actor.id,
    options.reject ? `booking.reject:${id}` : `booking.cancel:${id}`,
    key,
    { ...input, ...options },
    async (tx) => {
      const booking = await ownedBooking(
        tx,
        actor,
        id,
        staff || options.eventCancellation,
      );
      invariant(
        booking.version === input.version,
        "CONFLICT",
        "รายการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่",
      );
      invariant(
        [
          "PENDING_PAYMENT",
          "PENDING_REVIEW",
          "ACTION_REQUIRED",
          "CONFIRMED",
        ].includes(booking.status),
        "INVALID_TRANSITION",
        "ไม่สามารถยกเลิกรายการในสถานะนี้ได้",
      );
      if (!staff && !options.eventCancellation)
        invariant(
          booking.status === "PENDING_PAYMENT",
          "FORBIDDEN",
          "หลังส่งหลักฐานชำระเงิน กรุณาติดต่อเจ้าหน้าที่เพื่อยกเลิก",
          403,
        );
      if (options.reject)
        invariant(
          ["PENDING_REVIEW", "ACTION_REQUIRED"].includes(booking.status),
          "INVALID_TRANSITION",
          "ปฏิเสธได้เฉพาะรายการที่รอตรวจสอบ",
        );
      if (options.eventCancellation) {
        const event = await tx.event.findUnique({
          where: { id: booking.eventId },
        });
        invariant(
          event?.status === "CANCELLED",
          "INVALID_TRANSITION",
          "ต้องยกเลิกงานก่อนดำเนินการกับรายการจอง",
        );
      }
      const changed = await tx.booking.updateMany({
        where: { id, version: input.version, status: booking.status },
        data: {
          status: options.reject ? "REJECTED" : "CANCELLED",
          reason: input.reason,
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
      });
      invariant(
        changed.count === 1,
        "CONFLICT",
        "รายการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่",
      );
      await moveInventory(
        tx,
        booking,
        booking.status === "PENDING_PAYMENT"
          ? "HELD"
          : booking.status === "CONFIRMED"
            ? "SOLD"
            : "REVIEW_RESERVED",
        "RELEASED",
      );
      await tx.ticket.updateMany({
        where: { bookingId: id, status: { not: "REVOKED" } },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      await tx.paymentAttempt.updateMany({
        where: { bookingId: id, status: "SUBMITTED" },
        data: {
          status: "REJECTED",
          reviewerId: actor.id,
          reviewedAt: new Date(),
          reviewReason: input.reason,
        },
      });
      if (booking.verifiedPaymentId && booking.verifiedAmountSatang > 0)
        await tx.refundRecord.upsert({
          where: { bookingId: id },
          create: {
            bookingId: id,
            paymentId: booking.verifiedPaymentId,
            amountSatang: booking.verifiedAmountSatang,
            reason: input.reason,
          },
          update: {},
        });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: options.reject ? "BOOKING_REJECTED" : "BOOKING_CANCELLED",
          entity: "Booking",
          entityId: id,
          reason: input.reason,
        },
      });
      return bookingResult(tx, id);
    },
  );
}
