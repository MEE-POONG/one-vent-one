import { requireActor } from "@/server/auth";
import { api, idempotencyKey } from "@/server/http";
import { objectIdSchema } from "@/shared/booking";
import { confirmDemoPayment } from "@/server/services/payment";
import { rateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const POST = api(async (request, context) => {
  const actor = await requireActor(request);
  await rateLimit(actor.id, "payment", 20);
  return confirmDemoPayment(
    actor,
    objectIdSchema.parse((await context.params).id),
    idempotencyKey(request),
  );
});
