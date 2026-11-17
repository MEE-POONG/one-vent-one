import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { DomainError } from "@/server/errors";
import { transaction, type Tx } from "./transaction";

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}

export async function idempotent<T>(
  actorId: string,
  operation: string,
  key: string,
  payload: unknown,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  const requestHash = createHash("sha256")
    .update(canonical(payload))
    .digest("hex");
  return transaction(async (tx) => {
    const prior = await tx.idempotencyRecord.findUnique({
      where: { actorId_operation_key: { actorId, operation, key } },
    });
    if (prior) {
      if (prior.requestHash !== requestHash)
        throw new DomainError(
          "IDEMPOTENCY_CONFLICT",
          "รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว",
          409,
        );
      return prior.response as T;
    }
    const result = await work(tx);
    const response = JSON.parse(
      JSON.stringify(result),
    ) as Prisma.InputJsonValue;
    await tx.idempotencyRecord.create({
      data: {
        actorId,
        operation,
        key,
        requestHash,
        state: "COMPLETED",
        response,
      },
    });
    // The idempotency receipt and all effects commit atomically. An unknown commit is
    // resolved by retrying this same key, never by generating a fresh command.
    return JSON.parse(JSON.stringify(result)) as T;
  });
}
