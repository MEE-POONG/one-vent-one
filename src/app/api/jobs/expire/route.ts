import { timingSafeEqual } from "node:crypto";
import { api } from "@/server/http";
import { DomainError } from "@/server/errors";
import { prisma } from "@/server/db";
import { expireUnpaidHolds } from "@/server/services/booking";
export const runtime = "nodejs";
export const POST = api(async (request) => {
  const secret = process.env.JOB_SECRET;
  const supplied = request.headers.get("authorization") || "";
  const expected = "Bearer " + secret;
  if (
    !secret ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    throw new DomainError("UNAUTHENTICATED", "ไม่อนุญาตให้เรียกงานระบบ", 401);
  const expired = await expireUnpaidHolds();
  const now = new Date();
  const overdueReviews = await prisma.booking.count({
    where: { status: "PENDING_REVIEW", reviewDueAt: { lte: now } },
  });
  const overdueCorrections = await prisma.booking.count({
    where: { status: "ACTION_REQUIRED", correctionDueAt: { lte: now } },
  });
  await prisma.apiRateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
  return { ...expired, overdueReviews, overdueCorrections };
});
