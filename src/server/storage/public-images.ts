import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Actor } from "@/server/auth";
import { DomainError, invariant, notFound } from "@/server/errors";
import { requireRoles } from "@/server/permissions";
import { storageRoot } from "@/server/storage";

// Public artwork is isolated from private payment and refund evidence.
const imageDirectory = () => path.join(storageRoot(), "public-images");

export async function uploadPublicImage(
  actor: Actor,
  kind: "poster" | "artist" | "logo",
  file: File,
) {
  requireRoles(actor, kind === "logo" ? "SUPER_ADMIN" : "ADMIN");
  invariant(
    file.size > 0 && file.size <= 5 * 1024 * 1024,
    "VALIDATION_ERROR",
    "กรุณาเลือกรูปภาพขนาดไม่เกิน 5 MB",
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
    "รองรับเฉพาะรูป PNG, JPEG และ WebP ที่ถูกต้อง",
    422,
  );
  let image: Buffer;
  try {
    image = await sharp(bytes, {
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
      // Artist cut-outs keep a lossless alpha channel so transparent edges stay clean.
      .webp(kind === "artist" ? { quality: 90, alphaQuality: 100 } : { quality: 85 })
      .toBuffer();
  } catch {
    throw new DomainError(
      "VALIDATION_ERROR",
      "ไม่สามารถอ่านรูปภาพนี้ได้ กรุณาเลือกไฟล์ใหม่",
      422,
    );
  }
  const key = `${createHash("sha256").update(image).digest("hex")}.webp`;
  await mkdir(imageDirectory(), { recursive: true });
  try {
    await writeFile(path.join(imageDirectory(), key), image, { flag: "wx" });
  } catch (error) {
    // Identical uploads share an immutable file, including retries.
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
      throw error;
  }
  return { url: `/api/images/${key}` };
}

export async function publicImage(key: string) {
  if (!/^[a-f0-9]{64}\.webp$/.test(key)) throw notFound();
  let bytes: Buffer;
  try {
    bytes = await readFile(path.join(imageDirectory(), key));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      throw notFound();
    throw error;
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
