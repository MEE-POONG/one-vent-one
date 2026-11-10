import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Actor } from "@/server/auth";
import { prisma } from "@/server/db";
import { DomainError, invariant, notFound } from "@/server/errors";
import { hasRole } from "@/server/permissions";
import { ownedBooking } from "@/server/services/booking";
import { idempotent } from "@/server/services/idempotency";

function storageRoot() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.STORAGE_PERSISTENT !== "true"
  )
    throw new DomainError(
      "SERVICE_UNAVAILABLE",
      "ต้องตั้งค่าที่เก็บหลักฐานถาวรสำหรับระบบจริง",
      503,
    );
  return path.resolve(process.env.STORAGE_DIRECTORY || ".data/private-assets");
}
function filePath(key: string) {
  invariant(
    /^[a-f0-9]{64}\.png$/.test(key),
    "VALIDATION_ERROR",
    "รหัสไฟล์ไม่ถูกต้อง",
    422,
  );
  return path.join(storageRoot(), key);
}
export async function uploadEvidence(
  actor: Actor,
  bookingId: string,
  file: File,
  key: string,
) {
  const staff = hasRole(actor, "PAYMENT_REVIEWER");
  const booking = await ownedBooking(prisma, actor, bookingId, staff);
  invariant(
    staff || ["PENDING_PAYMENT", "ACTION_REQUIRED"].includes(booking.status),
    booking.status === "EXPIRED" ? "HOLD_EXPIRED" : "INVALID_TRANSITION",
    "รายการนี้ไม่รับหลักฐานใหม่ กรุณาติดต่อเจ้าหน้าที่",
  );
  invariant(
    staff ||
      booking.status !== "PENDING_PAYMENT" ||
      booking.holdExpiresAt > new Date(),
    "HOLD_EXPIRED",
    "หมดเวลาการจองแล้ว กรุณาติดต่อเจ้าหน้าที่",
  );
  invariant(
    file.size > 0 && file.size <= 5 * 1024 * 1024,
    "VALIDATION_ERROR",
    "ไฟล์หลักฐานต้องไม่เกิน 5 MB",
    422,
  );
  const bytes = Buffer.from(await file.arrayBuffer());
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP";
  invariant(
    (png && file.type === "image/png") ||
      (jpg && file.type === "image/jpeg") ||
      (webp && file.type === "image/webp"),
    "VALIDATION_ERROR",
    "รับเฉพาะไฟล์ภาพ PNG, JPEG หรือ WebP ที่ถูกต้อง",
    422,
  );
  let validated: Buffer;
  try {
    validated = await sharp(bytes, {
      limitInputPixels: 20_000_000,
      animated: false,
    })
      .rotate()
      .resize({
        width: 2500,
        height: 2500,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  } catch {
    throw new DomainError(
      "VALIDATION_ERROR",
      "ไม่สามารถอ่านไฟล์ภาพนี้ได้",
      422,
    );
  }
  invariant(
    validated.length <= 10 * 1024 * 1024,
    "VALIDATION_ERROR",
    "ภาพมีขนาดใหญ่เกินกำหนด",
    422,
  );
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const storageKey = randomBytes(32).toString("hex") + ".png";
  await mkdir(storageRoot(), { recursive: true });
  // Uploaded bytes are completed outside the short database transaction. Retried
  // submissions may leave an unreferenced file, never duplicate a financial record.
  await writeFile(filePath(storageKey), validated, { flag: "wx", mode: 0o600 });
  return idempotent(
    actor.id,
    `evidence.upload:${bookingId}`,
    key,
    { contentHash, mime: file.type, size: file.size },
    async (tx) => {
      await ownedBooking(tx, actor, bookingId, staff);
      const asset = await tx.mediaAsset.create({
        data: {
          storageKey,
          mime: "image/png",
          bytes: validated.length,
          ownerId: actor.id,
          bookingId,
          visibility: "PRIVATE",
          uploadStatus: "COMPLETE",
          contentHash,
        },
      });
      return { id: asset.id, mime: asset.mime, bytes: asset.bytes };
    },
  );
}

export async function privateAsset(actor: Actor, id: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) throw notFound();
  if (!hasRole(actor, "PAYMENT_REVIEWER")) {
    // Access follows current booking ownership and staff permissions. A former
    // reviewer cannot keep access merely because they uploaded a refund receipt.
    const booking = asset.bookingId
      ? await prisma.booking.findUnique({ where: { id: asset.bookingId } })
      : null;
    if (booking ? booking.userId !== actor.id : asset.ownerId !== actor.id)
      throw new DomainError("FORBIDDEN", "คุณไม่มีสิทธิ์อ่านหลักฐานนี้", 403);
  }
  invariant(
    asset.visibility === "PRIVATE" && asset.uploadStatus === "COMPLETE",
    "NOT_FOUND",
    "ไม่พบไฟล์นี้",
    404,
  );
  const bytes = await readFile(filePath(asset.storageKey));
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": 'inline; filename="evidence.png"',
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
