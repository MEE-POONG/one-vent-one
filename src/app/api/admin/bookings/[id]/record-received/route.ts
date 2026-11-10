import { requireActor } from "@/server/auth";
import { api, readJson, idempotencyKey } from "@/server/http";
import { lateReceiptSchema, objectIdSchema } from "@/shared/booking";
import { recordLateReceipt } from "@/server/services/payment";
import { requireRoles } from "@/server/permissions";
export const runtime = "nodejs";
export const POST = api(async (request, context) => {
  const actor = await requireActor(request);
  requireRoles(actor, "PAYMENT_REVIEWER");
  return recordLateReceipt(
    actor,
    objectIdSchema.parse((await context.params).id),
    await readJson(request, lateReceiptSchema),
    idempotencyKey(request),
  );
});
