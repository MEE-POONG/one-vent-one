import { requireActor } from "@/server/auth";
import { api, readJson, idempotencyKey } from "@/server/http";
import { completeRefundSchema, objectIdSchema } from "@/shared/booking";
import { completeRefund } from "@/server/services/refund";
export const runtime = "nodejs";
export const POST = api(async (request, context) => {
  const params = await context.params;
  return completeRefund(
    await requireActor(request),
    objectIdSchema.parse(params.id),
    objectIdSchema.parse(params.refundId),
    await readJson(request, completeRefundSchema),
    idempotencyKey(request),
  );
});
