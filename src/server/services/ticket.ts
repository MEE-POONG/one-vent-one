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

// 24 clean uppercase letters (excludes I and O so it never forms "OVO" or confuses O/0 or I/1)
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

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

export function revealToken(value: string, context: string) {
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

/**
 * Generates an 8-character ticket verification code:
 * - First 2 characters: 2 uppercase letters (A-Z, excluding I/O)
 * - Middle 3 characters: 3 digits representing the table number (e.g., T01 -> 001, T15 -> 015, T100 -> 100)
 * - Last 3 characters: 3 random digits (000-999) derived from the ticket's cryptographic tokenHash
 */
export function buildTicketCode(
  unitCodeOrLabel: string | null | undefined,
  tokenHash: string,
): string {
  const l1 =
    CODE_LETTERS[parseInt(tokenHash.slice(0, 2), 16) % CODE_LETTERS.length] ??
    "M";
  const l2 =
    CODE_LETTERS[parseInt(tokenHash.slice(2, 4), 16) % CODE_LETTERS.length] ??
    "K";
  const digits = String(unitCodeOrLabel || "").replace(/\D+/g, "");
  const tableDigits = (digits || "1").slice(-3).padStart(3, "0");
  const randomDigits = String(
    parseInt(tokenHash.slice(4, 12), 16) % 1000,
  ).padStart(3, "0");
  return `${l1}${l2}${tableDigits}${randomDigits}`;
}

export function extractUnitCodeFromSnapshot(snapshot: unknown): string {
  const snap = (snapshot ?? {}) as Record<string, unknown>;
  return String(
    snap.unitCode || snap.unitName || snap.ticketTypeName || "T001",
  );
}

/**
 * Issues exactly ONE ticket per booked table (BookingItem), regardless of how many seats
 * (`admissionCount`) are in the table. All guests sharing the table use this single pass
 * up to `item.admissionCount` check-ins.
 */
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
  for (const item of booking.items) {
    const sequence = 1;
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
  const allTickets = await prisma.ticket.findMany({
    where: { bookingId, ownerId: booking.userId },
    include: {
      bookingItem: true,
      checkIns: {
        where: { result: "ACCEPTED" },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ bookingItemId: "asc" }, { admissionSequence: "asc" }],
  });

  // Deduplicate by bookingItemId so each booked table always shows 1 single pass
  const seenItemIds = new Set<string>();
  const primaryTickets = allTickets.filter((t) => {
    if (seenItemIds.has(t.bookingItemId)) return false;
    seenItemIds.add(t.bookingItemId);
    return true;
  });

  return {
    tickets: primaryTickets.map((ticket) => {
      const snap = (ticket.bookingItem.snapshot ?? {}) as Record<
        string,
        unknown
      >;
      const unitCode = extractUnitCodeFromSnapshot(snap);
      const ticketCode = buildTicketCode(unitCode, ticket.tokenHash);
      const totalAdmissions = Math.max(1, ticket.bookingItem.admissionCount);
      const checkedInCount = ticket.checkIns.length;
      const remainingAdmissions = Math.max(0, totalAdmissions - checkedInCount);
      const effectiveStatus =
        ticket.status === "REVOKED"
          ? "REVOKED"
          : ticket.status === "USED" || checkedInCount >= totalAdmissions
            ? "USED"
            : "ACTIVE";

      return {
        id: ticket.id,
        status: effectiveStatus,
        admissionSequence: 1,
        totalAdmissions,
        checkedInCount,
        remainingAdmissions,
        ticketCode,
        unitCode: snap.unitCode ? String(snap.unitCode) : null,
        usedAt: ticket.usedAt,
        itemLabel: String(snap.unitName || snap.unitCode || "บัตรเข้างาน"),
        token:
          ticket.status === "REVOKED"
            ? undefined
            : revealToken(
                ticket.encryptedToken,
                `${bookingId}:${ticket.bookingItemId}:${ticket.admissionSequence}`,
              ),
      };
    }),
    serverNow: new Date().toISOString(),
  };
}

export type ParsedTicketInput =
  | { kind: "token"; value: string }
  | { kind: "code"; value: string };

export function parseTicketLookupInput(raw: string): ParsedTicketInput | null {
  const trimmed = raw.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(trimmed)) {
    return { kind: "token", value: trimmed };
  }
  const urlMatch = trimmed.match(
    /\/tickets\/verify\/([A-Za-z0-9_-]{43}|[A-Za-z]{2}\d{6})(?:[/?#]|$)/i,
  );
  if (urlMatch) {
    const captured = urlMatch[1];
    if (/^[A-Za-z0-9_-]{43}$/.test(captured)) {
      return { kind: "token", value: captured };
    }
    return { kind: "code", value: captured.toUpperCase() };
  }
  const compact = trimmed.replace(/[\s-]+/g, "").toUpperCase();
  if (/^[A-Z]{2}\d{6}$/.test(compact)) {
    return { kind: "code", value: compact };
  }
  return null;
}

export function extractTicketToken(raw: string): string | null {
  const parsed = parseTicketLookupInput(raw);
  return parsed ? parsed.value : null;
}

export async function inspectTicketByToken(rawInput: string) {
  const parsed = parseTicketLookupInput(rawInput);
  if (!parsed) {
    throw new DomainError(
      "TICKET_INVALID",
      "รูปแบบรหัสบัตรไม่ถูกต้อง กรุณากรอกรหัสบัตร 8 หลัก หรือสแกน QR Code จากหลังบัตร",
      422,
    );
  }

  const includeSpec = {
    event: true,
    booking: true,
    bookingItem: true,
    owner: { select: { name: true, email: true } },
    usedBy: { select: { name: true } },
    checkIns: {
      orderBy: { createdAt: "desc" as const },
      take: 50,
    },
  };

  let ticket = null;
  if (parsed.kind === "token") {
    const tokenHash = hashTicketToken(parsed.value);
    ticket = await prisma.ticket.findUnique({
      where: { tokenHash },
      include: includeSpec,
    });
  } else {
    const candidates = await prisma.ticket.findMany({
      where: { admissionSequence: 1 },
      include: includeSpec,
      orderBy: { createdAt: "desc" },
      take: 2500,
    });
    ticket =
      candidates.find((t) => {
        const uCode = extractUnitCodeFromSnapshot(t.bookingItem.snapshot);
        return buildTicketCode(uCode, t.tokenHash) === parsed.value;
      }) ?? null;
  }

  if (!ticket) {
    throw new DomainError(
      "TICKET_INVALID",
      "ไม่พบข้อมูลบัตรนี้ในระบบ กรุณาตรวจสอบรหัสบัตร 8 หลักหรือ QR Code อีกครั้ง",
      404,
    );
  }

  const itemSnap = (ticket.bookingItem.snapshot ?? {}) as Record<
    string,
    unknown
  >;
  const bookingSnap = (ticket.booking.snapshot ?? {}) as Record<
    string,
    unknown
  >;
  const unitCodeStr = extractUnitCodeFromSnapshot(itemSnap);
  const ticketCode = buildTicketCode(unitCodeStr, ticket.tokenHash);

  const acceptedCheckIns = ticket.checkIns.filter(
    (c) => c.result === "ACCEPTED",
  );
  const totalItemAdmissions = Math.max(1, ticket.bookingItem.admissionCount);
  const checkedInCount = acceptedCheckIns.length;
  const remainingAdmissions = Math.max(0, totalItemAdmissions - checkedInCount);

  const effectiveStatus =
    ticket.status === "REVOKED"
      ? "REVOKED"
      : ticket.status === "USED" || checkedInCount >= totalItemAdmissions
        ? "USED"
        : "ACTIVE";

  const isEventActive = ["PUBLISHED", "CLOSED"].includes(ticket.event.status);
  const isGenuineActive =
    effectiveStatus === "ACTIVE" &&
    remainingAdmissions > 0 &&
    ticket.booking.status === "CONFIRMED" &&
    isEventActive;

  let revealedToken = parsed.kind === "token" ? parsed.value : ticketCode;
  if (ticket.status !== "REVOKED") {
    try {
      revealedToken = revealToken(
        ticket.encryptedToken,
        `${ticket.bookingId}:${ticket.bookingItemId}:${ticket.admissionSequence}`,
      );
    } catch {
      // Fallback if key differs
    }
  }

  return {
    valid: isGenuineActive,
    ticketId: ticket.id,
    token: revealedToken,
    ticketCode,
    status: effectiveStatus,
    admissionSequence: 1,
    totalItemAdmissions,
    checkedInCount,
    remainingAdmissions,
    sellingMode: ticket.bookingItem.sellingMode,
    itemLabel: String(
      itemSnap.unitName ||
        itemSnap.ticketTypeName ||
        itemSnap.unitCode ||
        "บัตรเข้างาน",
    ),
    unitCode: itemSnap.unitCode ? String(itemSnap.unitCode) : null,
    zoneName: String(itemSnap.zoneName || "โต๊ะภายในงาน"),
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
          : "ชำระเงินผ่านระบบแล้ว",
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
      ticketCode,
      verificationCode: ticketCode,
      sha256Fingerprint: `${ticket.tokenHash.slice(0, 10).toUpperCase()} •••• ${ticket.tokenHash.slice(-10).toUpperCase()}`,
      fullHashPrefix: ticket.tokenHash.slice(0, 24).toUpperCase(),
      encryptionSuite: "AES-256-GCM + SHA-256 Digital Seal",
      layoutVersionId: String(
        itemSnap.layoutVersionId || ticket.booking.layoutVersionId || "STD-V1",
      ),
      issuedAt: ticket.createdAt.toISOString(),
      usedAt: ticket.usedAt?.toISOString() ?? null,
      usedByStaff: ticket.usedBy?.name ?? null,
      revokedAt: ticket.revokedAt?.toISOString() ?? null,
      checkInAttempts: ticket.checkIns.length,
      acceptedCheckIns: checkedInCount,
      checkInHistory: acceptedCheckIns.map((c) => c.createdAt.toISOString()),
      serverVerifiedAt: new Date().toISOString(),
    },
  };
}
