import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { DomainError } from "./errors";

export async function rateLimit(
  actorId: string,
  operation: string,
  limit: number,
  seconds = 60,
) {
  const now = Date.now();
  const bucket = Math.floor(now / (seconds * 1000));
  const key = createHash("sha256")
    .update(`${actorId}:${operation}:${bucket}`)
    .digest("hex");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = await prisma.apiRateLimit.upsert({
        where: { key },
        create: {
          key,
          count: 1,
          expiresAt: new Date((bucket + 1) * seconds * 1000),
        },
        update: { count: { increment: 1 } },
      });
      if (row.count > limit)
        throw new DomainError(
          "RATE_LIMITED",
          "ส่งคำขอถี่เกินไป กรุณารอสักครู่",
          429,
        );
      return;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
}
