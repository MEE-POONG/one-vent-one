import { requireActor } from "@/server/auth";
import { api, readJson, idempotencyKey } from "@/server/http";
import { paymentSchema, objectIdSchema } from "@/shared/booking";
import { submitPayment } from "@/server/services/payment";
import { rateLimit } from "@/server/rate-limit";
export const runtime = "nodejs";
export const POST = api(async (request, context) => {
  const actor = await requireActor(request);
  await rateLimit(actor.id, "payment", 20);
  return submitPayment(
    actor,
    objectIdSchema.parse((await context.params).id),
    await readJson(request, paymentSchema),
    idempotencyKey(request),
  );
});
