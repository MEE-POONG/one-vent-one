import "server-only";
import type { Actor } from "@/server/auth";
import { DomainError, invariant } from "@/server/errors";
import { requireRoles } from "@/server/permissions";
import type { CheckInInput } from "@/shared/booking";
import { idempotent } from "./idempotency";
import {
  buildTicketCode,
  extractUnitCodeFromSnapshot,
  hashTicketToken,
  parseTicketLookupInput,
} from "./ticket";

export async function checkIn(actor: Actor, input: CheckInInput, key: string) {
  // Any shop staff member may check tickets in at the door, for every event.
  requireRoles(actor, "ADMIN");

  const parsed = parseTicketLookupInput(input.token);
  if (!parsed) {
    throw new DomainError(
      "TICKET_INVALID",
      "รูปแบบรหัสบัตรไม่ถูกต้อง กรุณากรอกรหัสบัตร 8 หลัก (เช่น MK001482) หรือสแกน QR Code จากหลังบัตร",
      422,
    );
  }

  const lookupDigest =
    parsed.kind === "token"
      ? hashTicketToken(parsed.value)
      : `CODE:${parsed.value}`;

  const result = await idempotent(
    actor.id,
    "ticket.check-in",
    key,
    { eventId: input.eventId, lookupDigest },
    async (tx) => {
      const event = await tx.event.findUnique({ where: { id: input.eventId } });
      invariant(event, "NOT_FOUND", "ไม่พบงานนี้", 404);

      let ticket = null;
      if (parsed.kind === "token") {
        const tokenHash = hashTicketToken(parsed.value);
        ticket = await tx.ticket.findUnique({
          where: { tokenHash },
          include: { booking: true, bookingItem: true },
        });
      } else {
        const eventTickets = await tx.ticket.findMany({
          where: { eventId: input.eventId, admissionSequence: 1 },
          include: { booking: true, bookingItem: true },
        });
        ticket =
          eventTickets.find((t) => {
            const uCode = extractUnitCodeFromSnapshot(t.bookingItem.snapshot);
            return buildTicketCode(uCode, t.tokenHash) === parsed.value;
          }) ?? null;
      }

      const maxAdmissions = ticket
        ? Math.max(1, ticket.bookingItem.admissionCount)
        : 1;
      const acceptedCount = ticket
        ? await tx.checkInLog.count({
            where: { ticketId: ticket.id, result: "ACCEPTED" },
          })
        : 0;

      let errorCode: string | undefined;
      let message = "";
      if (!ticket || ticket.eventId !== input.eventId) {
        errorCode = "TICKET_INVALID";
        message = "ไม่พบบัตรนี้สำหรับอีเวนท์ที่เลือก กรุณาตรวจสอบรหัสบัตร 8 หลักหรืออีเวนท์";
      } else if (
        ticket.status === "REVOKED" ||
        ticket.booking.status !== "CONFIRMED" ||
        !["PUBLISHED", "CLOSED"].includes(event.status)
      ) {
        errorCode = "TICKET_REVOKED";
        message = "บัตรนี้ถูกยกเลิกหรือไม่สามารถใช้กับงานนี้ได้";
      } else if (ticket.status === "USED" || acceptedCount >= maxAdmissions) {
        errorCode = "TICKET_ALREADY_USED";
        message = `บัตรโต๊ะนี้ใช้เข้างานครบทั้ง ${maxAdmissions} ที่นั่งแล้ว (${acceptedCount}/${maxAdmissions}) ล่าสุดเมื่อ ${
          ticket.usedAt
            ? new Intl.DateTimeFormat("th-TH", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Bangkok",
              }).format(ticket.usedAt)
            : ""
        }`;
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
      const newCheckedInCount = acceptedCount + 1;
      const isNowFullyUsed = newCheckedInCount >= maxAdmissions;
      const nextStatus = isNowFullyUsed ? "USED" : "ACTIVE";

      const used = await tx.ticket.updateMany({
        where: { id: ticket.id, status: "ACTIVE" },
        data: { status: nextStatus, usedAt, usedById: actor.id },
      });
      invariant(
        used.count === 1,
        "TICKET_ALREADY_USED",
        "บัตรโต๊ะนี้ใช้สิทธิ์เข้างานครบทุกที่นั่งแล้ว",
      );

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
          reason: `เช็กอินเข้างานครั้งที่ ${newCheckedInCount}/${maxAdmissions}`,
        },
      });

      const snap = (ticket.bookingItem.snapshot ?? {}) as Record<
        string,
        unknown
      >;
      const unitCode = extractUnitCodeFromSnapshot(snap);
      const ticketCode = buildTicketCode(unitCode, ticket.tokenHash);

      return {
        ticketId: ticket.id,
        ticketCode,
        itemLabel: String(snap.unitName || snap.unitCode || "บัตรโต๊ะ"),
        status: nextStatus as "ACTIVE" | "USED",
        checkedInCount: newCheckedInCount,
        totalAdmissions: maxAdmissions,
        remainingAdmissions: Math.max(0, maxAdmissions - newCheckedInCount),
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
