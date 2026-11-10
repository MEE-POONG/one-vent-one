import "server-only";
import type { Actor } from "@/server/auth";
import { DomainError, invariant } from "@/server/errors";
import { requireCheckInEvent } from "@/server/permissions";
import type { CheckInInput } from "@/shared/booking";
import { idempotent } from "./idempotency";
import { hashTicketToken } from "./ticket";

export async function checkIn(actor: Actor, input: CheckInInput, key: string) {
  requireCheckInEvent(actor, input.eventId);
  // Hash in the durable receipt, never save a QR credential in payload/logs.
  const tokenHash = hashTicketToken(input.token);
  const result = await idempotent(
    actor.id,
    "ticket.check-in",
    key,
    { eventId: input.eventId, tokenHash },
    async (tx) => {
      const event = await tx.event.findUnique({ where: { id: input.eventId } });
      invariant(event, "NOT_FOUND", "ไม่พบงานนี้", 404);
      const ticket = await tx.ticket.findUnique({
        where: { tokenHash },
        include: { booking: true },
      });
      let errorCode: string | undefined;
      let message = "";
      if (!ticket || ticket.eventId !== input.eventId) {
        errorCode = "TICKET_INVALID";
        message = "ไม่พบบัตรสำหรับงานนี้";
      } else if (
        ticket.status === "REVOKED" ||
        ticket.booking.status !== "CONFIRMED" ||
        !["PUBLISHED", "CLOSED"].includes(event.status)
      ) {
        errorCode = "TICKET_REVOKED";
        message = "บัตรนี้ถูกเพิกถอนหรือไม่สามารถใช้กับงานนี้ได้";
      } else if (ticket.status === "USED") {
        errorCode = "TICKET_ALREADY_USED";
        message = `บัตรนี้ใช้แล้วเมื่อ ${ticket.usedAt ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(ticket.usedAt) : ""}`;
      }
      if (errorCode) {
        await tx.checkInLog.create({
          data: {
            eventId: input.eventId,
            actorId: actor.id,
            ticketId: ticket?.eventId === input.eventId ? ticket.id : null,
            result: errorCode,
          },
        });
        return { errorCode, message };
      }
      invariant(ticket, "TICKET_INVALID", "ไม่พบบัตร");
      const eventFence = await tx.event.updateMany({
        where: { id: event.id, version: event.version, status: event.status },
        data: { version: { increment: 1 } },
      });
      const bookingFence = await tx.booking.updateMany({
        where: {
          id: ticket.bookingId,
          version: ticket.booking.version,
          status: "CONFIRMED",
        },
        data: { version: { increment: 1 } },
      });
      invariant(
        eventFence.count === 1 && bookingFence.count === 1,
        "CONFLICT",
        "สถานะงานหรือบัตรเปลี่ยนแปลง กรุณาตรวจใหม่",
      );
      const usedAt = new Date();
      const used = await tx.ticket.updateMany({
        where: { id: ticket.id, status: "ACTIVE" },
        data: { status: "USED", usedAt, usedById: actor.id },
      });
      invariant(used.count === 1, "TICKET_ALREADY_USED", "บัตรนี้ถูกใช้แล้ว");
      await tx.checkInLog.create({
        data: {
          eventId: event.id,
          actorId: actor.id,
          ticketId: ticket.id,
          result: "ACCEPTED",
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "TICKET_CHECKED_IN",
          entity: "Ticket",
          entityId: ticket.id,
        },
      });
      return {
        ticketId: ticket.id,
        status: "USED" as const,
        usedAt: usedAt.toISOString(),
      };
    },
  );
  if ("errorCode" in result && result.errorCode)
    throw new DomainError(
      result.errorCode,
      result.message || "ไม่สามารถใช้บัตรนี้ได้",
      409,
    );
  return result;
}
