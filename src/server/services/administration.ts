import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import type { Actor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { invariant } from "@/server/errors";
import { idempotent } from "./idempotency";
import { audit } from "./event-admin";
import type { Prisma, Role } from "@prisma/client";
import { type AccessLevel, businessInput, staffInput } from "@/shared/catalog";

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
    // The acting owner always stays SUPER_ADMIN, so the shop can never be left
    // without an owner account.
    invariant(
      input.userId !== actor.id || input.role === "SUPER_ADMIN",
      "FORBIDDEN",
      "ไม่สามารถลดสิทธิ์ผู้ดูแลสูงสุดของตัวเอง",
      403,
    );
    const before = await tx.user.findUnique({
      where: { id: input.userId },
      select: { roles: true },
    });
    invariant(before, "NOT_FOUND", "ไม่พบผู้ใช้", 404);
    const user = await tx.user.update({
      where: { id: input.userId },
      data: { roles: rolesFor(input.role) },
      select: { id: true, name: true, email: true, roles: true },
    });
    await audit(
      tx,
      actor.id,
      "STAFF_PERMISSIONS_UPDATE",
      "User",
      input.userId,
      input.reason,
      { before: before.roles, after: user.roles },
    );
    return { ...user, role: accessLevel(user.roles) };
  });
}
/** Stored roles for an access level. CUSTOMER is kept so staff can also book. */
export function rolesFor(level: AccessLevel): Role[] {
  return level === "CUSTOMER" ? ["CUSTOMER"] : ["CUSTOMER", level];
}
export function accessLevel(roles: Role[]): AccessLevel {
  return roles.includes("SUPER_ADMIN")
    ? "SUPER_ADMIN"
    : roles.includes("ADMIN")
      ? "ADMIN"
      : "CUSTOMER";
}
export async function listStaff(
  q: string,
  page: number,
  pageSize: number,
  staffOnly = false,
) {
  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(staffOnly ? { roles: { hasSome: ["ADMIN", "SUPER_ADMIN"] } } : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, email: true, roles: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);
  return {
    items: users.map((u) => ({ ...u, role: accessLevel(u.roles) })),
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
    soldAdmissions: statusTotals.CONFIRMED?.admissions ?? admissions,
    checkedIn,
    pendingRefundCount: refundPending._count.id,
    pendingRefundSatang: refundPending._sum.amountSatang ?? 0,
  };
}
