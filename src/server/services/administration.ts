import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import type { Actor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { invariant } from "@/server/errors";
import { idempotent } from "./idempotency";
import { audit } from "./event-admin";
import { businessInput, staffInput } from "@/shared/catalog";

export async function updateBusiness(
  actor: Actor,
  input: z.infer<typeof businessInput>,
  key: string,
) {
  requireRoles(actor, "SUPER_ADMIN");
  return idempotent(actor.id, "business:update", key, input, async (tx) => {
    const { bookingPolicy, ...fields } = input;
    const profile = await tx.businessProfile.update({
      where: { key: "primary" },
      data: {
        ...fields,
        bookingPolicy,
        holdMinutes: bookingPolicy.holdMinutes,
        reviewHours: bookingPolicy.reviewHours,
        correctionHours: bookingPolicy.correctionHours,
        version: { increment: 1 },
      },
    });
    await audit(tx, actor.id, "BUSINESS_UPDATE", "BusinessProfile", profile.id);
    return profile;
  });
}
export async function updateStaff(
  actor: Actor,
  input: z.infer<typeof staffInput>,
  key: string,
) {
  requireRoles(actor, "SUPER_ADMIN");
  return idempotent(actor.id, "staff:update", key, input, async (tx) => {
    invariant(
      input.userId !== actor.id || input.roles.includes("SUPER_ADMIN"),
      "FORBIDDEN",
      "ไม่สามารถถอนสิทธิ์ผู้ดูแลสูงสุดของตัวเอง",
      403,
    );
    const eventIds = [...new Set(input.assignedEventIds)];
    invariant(
      (await tx.event.count({ where: { id: { in: eventIds } } })) ===
        eventIds.length,
      "VALIDATION_ERROR",
      "มีรหัสงานที่ไม่ถูกต้อง",
      422,
    );
    const user = await tx.user.update({
      where: { id: input.userId },
      data: { roles: [...new Set(input.roles)] },
      select: { id: true, name: true, email: true, roles: true },
    });
    await tx.staffEventAssignment.deleteMany({
      where: { userId: input.userId },
    });
    for (const eventId of eventIds)
      await tx.staffEventAssignment.create({
        data: { userId: input.userId, eventId },
      });
    await audit(
      tx,
      actor.id,
      "STAFF_PERMISSIONS_UPDATE",
      "User",
      input.userId,
      input.reason,
      { roles: user.roles, assignedEventIds: eventIds },
    );
    return { ...user, assignedEventIds: eventIds };
  });
}
export async function listStaff(q: string, page: number, pageSize: number) {
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        assignments: { select: { eventId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);
  return {
    items: users.map(({ assignments, ...u }) => ({
      ...u,
      assignedEventIds: assignments.map((a) => a.eventId),
    })),
    total,
    page,
    pageSize,
  };
}
export async function getReports(eventId?: string) {
  const where = eventId ? { eventId } : {};
  const [
    statuses,
    received,
    refunds,
    admissions,
    checkedIn,
    publishedEvents,
    overdueReview,
    refundPending,
  ] = await Promise.all([
    prisma.booking.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
      _sum: { totalSatang: true, totalAdmissions: true },
    }),
    prisma.booking.aggregate({ where, _sum: { verifiedAmountSatang: true } }),
    prisma.refundRecord.aggregate({
      where: {
        status: "REFUNDED",
        ...(eventId ? { booking: { eventId } } : {}),
      },
      _sum: { amountSatang: true },
    }),
    prisma.ticket.count({
      where: { ...where, status: { in: ["ACTIVE", "USED"] } },
    }),
    prisma.checkInLog.count({ where: { ...where, result: "ACCEPTED" } }),
    prisma.event.count({
      where: { status: "PUBLISHED", ...(eventId ? { id: eventId } : {}) },
    }),
    prisma.booking.count({
      where: {
        ...where,
        OR: [
          { status: "PENDING_REVIEW", reviewDueAt: { lt: new Date() } },
          { status: "ACTION_REQUIRED", correctionDueAt: { lt: new Date() } },
        ],
      },
    }),
    prisma.refundRecord.aggregate({
      where: {
        status: "PENDING",
        ...(eventId ? { booking: { eventId } } : {}),
      },
      _count: { id: true },
      _sum: { amountSatang: true },
    }),
  ]);
  const statusTotals = Object.fromEntries(
    statuses.map((s) => [
      s.status,
      {
        count: s._count.id,
        totalSatang: s._sum.totalSatang ?? 0,
        admissions: s._sum.totalAdmissions ?? 0,
      },
    ]),
  );
  const receivedSatang = received._sum.verifiedAmountSatang ?? 0,
    refundedSatang = refunds._sum.amountSatang ?? 0;
  return {
    serverNow: new Date().toISOString(),
    statusTotals,
    publishedEvents,
    reviewQueue:
      (statusTotals.PENDING_REVIEW?.count ?? 0) +
      (statusTotals.ACTION_REQUIRED?.count ?? 0),
    overdueReview,
    confirmedSatang: statusTotals.CONFIRMED?.totalSatang ?? 0,
    receivedSatang,
    refundedSatang,
    netReceivedSatang: receivedSatang - refundedSatang,
    soldAdmissions: admissions,
    checkedIn,
    pendingRefundCount: refundPending._count.id,
    pendingRefundSatang: refundPending._sum.amountSatang ?? 0,
  };
}
