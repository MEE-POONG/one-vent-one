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
    where: { bookingId, ownerId: booking.userId },
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

export function extractTicketToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/tickets\/verify\/([A-Za-z0-9_-]{43})(?:[/?#]|$)/);
  if (match) return match[1];
  return null;
}

export async function inspectTicketByToken(rawToken: string) {
  const token = extractTicketToken(rawToken);
  if (!token) {
    throw new DomainError(
      "TICKET_INVALID",
      "รูปแบบรหัสบัตรไม่ถูกต้อง กรุณาใช้ QR Code จากระบบ OneVentOne",
      422,
    );
  }
  const tokenHash = hashTicketToken(token);
  const ticket = await prisma.ticket.findUnique({
    where: { tokenHash },
    include: {
      event: true,
      booking: true,
      bookingItem: true,
      owner: { select: { name: true, email: true } },
      usedBy: { select: { name: true } },
      checkIns: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!ticket) {
    throw new DomainError(
      "TICKET_INVALID",
      "ไม่พบข้อมูลบัตรนี้ในระบบ อาจเป็นบัตรปลอมหรือรหัสไม่ถูกต้อง",
      404,
    );
  }

  const itemSnap = (ticket.bookingItem.snapshot ?? {}) as Record<string, unknown>;
  const bookingSnap = (ticket.booking.snapshot ?? {}) as Record<string, unknown>;
  const isEventActive = ["PUBLISHED", "CLOSED"].includes(ticket.event.status);
  const isGenuineActive =
    ticket.status === "ACTIVE" &&
    ticket.booking.status === "CONFIRMED" &&
    isEventActive;

  return {
    valid: isGenuineActive,
    ticketId: ticket.id,
    token,
    status: ticket.status,
    admissionSequence: ticket.admissionSequence,
    totalItemAdmissions: ticket.bookingItem.admissionCount,
    sellingMode: ticket.bookingItem.sellingMode,
    itemLabel: String(
      itemSnap.unitName ||
        itemSnap.ticketTypeName ||
        itemSnap.unitCode ||
        "บัตรเข้างาน",
    ),
    unitCode: itemSnap.unitCode ? String(itemSnap.unitCode) : null,
    zoneName: String(itemSnap.zoneName || "โซนมาตรฐาน"),
    holderName: ticket.owner.name,
    isGuestBooking: ticket.owner.email.endsWith("@guest.oneventone.local"),
    booking: {
      id: ticket.booking.id,
      bookingNumber: ticket.booking.bookingNumber,
      status: ticket.booking.status,
      totalSatang: ticket.booking.totalSatang,
      totalAdmissions: ticket.booking.totalAdmissions,
      confirmedAt: ticket.booking.confirmedAt?.toISOString() ?? null,
      createdAt: ticket.booking.createdAt.toISOString(),
      paymentMethod:
        bookingSnap.paymentMode === "DEMO_QR"
          ? "QR Code อัตโนมัติ (Instant QR)"
          : "โอนชำระและตรวจสอบแล้ว",
    },
    event: {
      id: ticket.event.id,
      slug: ticket.event.slug,
      title: ticket.event.title,
      venue: ticket.event.venue,
      artists: ticket.event.artists,
      posterUrl: ticket.event.posterUrl,
      startsAt: ticket.event.startsAt.toISOString(),
      endsAt: ticket.event.endsAt.toISOString(),
      status: ticket.event.status,
    },
    verification: {
      verificationCode: `VER-${tokenHash.slice(0, 12).toUpperCase()}`,
      sha256Fingerprint: `${tokenHash.slice(0, 10).toUpperCase()} •••• ${tokenHash.slice(-10).toUpperCase()}`,
      fullHashPrefix: tokenHash.slice(0, 24).toUpperCase(),
      encryptionSuite: "AES-256-GCM + SHA-256 Digital Seal",
      layoutVersionId: String(
        itemSnap.layoutVersionId || ticket.booking.layoutVersionId || "STD-V1",
      ),
      issuedAt: ticket.createdAt.toISOString(),
      usedAt: ticket.usedAt?.toISOString() ?? null,
      usedByStaff: ticket.usedBy?.name ?? null,
      revokedAt: ticket.revokedAt?.toISOString() ?? null,
      checkInAttempts: ticket.checkIns.length,
      serverVerifiedAt: new Date().toISOString(),
    },
  };
}
