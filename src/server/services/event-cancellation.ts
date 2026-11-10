import "server-only";
import { prisma } from "@/server/db";
import type { Actor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { invariant } from "@/server/errors";
import { changeEventStatus } from "./event-admin";
import { cancelBooking } from "./booking";

export async function cancelEventBatch(
  actor: Actor,
  eventId: string,
  input: { version: number; reason: string },
  key: string,
) {
  requireRoles(actor, "EVENT_MANAGER");
  let event = await prisma.event.findUnique({ where: { id: eventId } });
  invariant(event, "NOT_FOUND", "ไม่พบงาน", 404);
  if (event.status !== "CANCELLED")
    event = await changeEventStatus(actor, eventId, "CANCELLED", input, key);
  const bookings = await prisma.booking.findMany({
    where: {
      eventId,
      status: {
        in: [
          "PENDING_PAYMENT",
          "PENDING_REVIEW",
          "ACTION_REQUIRED",
          "CONFIRMED",
        ],
      },
    },
    orderBy: { createdAt: "asc" },
    take: 25,
    select: { id: true, version: true },
  });
  const failures: string[] = [];
  for (const booking of bookings) {
    try {
      await cancelBooking(
        actor,
        booking.id,
        {
          version: booking.version,
          reason: event.cancellationReason || input.reason,
        },
        `event-cancel:${eventId}:${booking.id}`,
        { eventCancellation: true },
      );
    } catch {
      failures.push(booking.id);
    }
  }
  const [remaining, pendingRefundCount] = await Promise.all([
    prisma.booking.count({
      where: {
        eventId,
        status: {
          in: [
            "PENDING_PAYMENT",
            "PENDING_REVIEW",
            "ACTION_REQUIRED",
            "CONFIRMED",
          ],
        },
      },
    }),
    prisma.refundRecord.count({
      where: { booking: { eventId }, status: "PENDING" },
    }),
  ]);
  if (remaining === 0)
    await prisma.event.updateMany({
      where: { id: eventId, status: "CANCELLED" },
      data: { cancellationProcessedAt: new Date() },
    });
  return {
    eventId,
    status: "CANCELLED",
    processed: bookings.length - failures.length,
    remaining,
    failedBookingIds: failures,
    pendingRefundCount,
    complete: remaining === 0,
  };
}
