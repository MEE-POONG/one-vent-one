import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { Actor } from "@/server/auth";
import { prisma } from "@/server/db";
import { DomainError, invariant } from "@/server/errors";
import { ownedBooking } from "./booking";
import type { Tx } from "./transaction";

function encryptionKey() {
  const value = process.env.TICKET_ENCRYPTION_KEY;
  const key = value ? Buffer.from(value, "base64") : Buffer.alloc(0);
  if (key.length !== 32)
    throw new DomainError(
      "SERVICE_UNAVAILABLE",
      "ระบบออกบัตรยังไม่ได้ตั้งค่ากุญแจรักษาความปลอดภัย",
      503,
    );
  return key;
}
export function hashTicketToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function protectToken(token: string, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
function revealToken(value: string, context: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted)
    throw new DomainError("SERVICE_UNAVAILABLE", "ไม่สามารถอ่านบัตรได้", 503);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function issueTickets(tx: Tx, bookingId: string) {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { items: true },
  });
  invariant(
    booking.status === "CONFIRMED",
    "INVALID_TRANSITION",
    "ออกบัตรได้หลังอนุมัติการชำระเงินเท่านั้น",
  );
  const tickets = [];
  for (const item of booking.items)
    for (let sequence = 1; sequence <= item.admissionCount; sequence++) {
      const token = randomBytes(32).toString("base64url");
      tickets.push({
        bookingId,
        bookingItemId: item.id,
        eventId: booking.eventId,
        ownerId: booking.userId,
        admissionSequence: sequence,
        tokenHash: hashTicketToken(token),
        encryptedToken: protectToken(
          token,
          `${bookingId}:${item.id}:${sequence}`,
        ),
      });
    }
  await tx.ticket.createMany({ data: tickets });
}

export async function getTickets(actor: Actor, bookingId: string) {
  const booking = await ownedBooking(prisma, actor, bookingId);
  if (booking.status !== "CONFIRMED")
    return { tickets: [], serverNow: new Date().toISOString() };
  const tickets = await prisma.ticket.findMany({
    where: { bookingId, ownerId: actor.id },
    include: { bookingItem: true },
    orderBy: [{ bookingItemId: "asc" }, { admissionSequence: "asc" }],
  });
  return {
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      status: ticket.status,
      admissionSequence: ticket.admissionSequence,
      usedAt: ticket.usedAt,
      itemLabel:
        (ticket.bookingItem.snapshot as Record<string, unknown>).unitName ||
        "บัตรเข้างาน",
      token:
        ticket.status === "REVOKED"
          ? undefined
          : revealToken(
              ticket.encryptedToken,
              `${bookingId}:${ticket.bookingItemId}:${ticket.admissionSequence}`,
            ),
    })),
    serverNow: new Date().toISOString(),
  };
}
