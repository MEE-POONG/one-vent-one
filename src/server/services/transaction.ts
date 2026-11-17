import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";

export type Tx = Prisma.TransactionClient;

export async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await prisma.$transaction(work, {
        maxWait: 10_000,
        timeout: 20_000,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2028", "P2002"].includes(error.code);
      if (!retryable) throw error;
      if (attempt === 5)
        throw new DomainError(
          "CONFLICT",
          "มีการเปลี่ยนแปลงพร้อมกัน กรุณาลองคำขอเดิมอีกครั้ง",
          409,
        );
      await new Promise((resolve) =>
        setTimeout(resolve, 20 * 2 ** attempt + Math.floor(Math.random() * 30)),
      );
    }
  }
  throw new DomainError("CONFLICT", "กรุณาลองคำขอเดิมอีกครั้ง", 409);
}
