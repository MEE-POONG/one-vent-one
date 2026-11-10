import { requireActor } from "@/server/auth";
import { api, readJson, idempotencyKey } from "@/server/http";
import { actionSchema, objectIdSchema } from "@/shared/booking";
import { requestCorrection } from "@/server/services/payment";
import { requireRoles } from "@/server/permissions";
export const runtime = "nodejs";
export const POST = api(async (request, context) => {
  const actor = await requireActor(request);
  requireRoles(actor, "PAYMENT_REVIEWER");
  return requestCorrection(
    actor,
    objectIdSchema.parse((await context.params).id),
    await readJson(request, actionSchema),
    idempotencyKey(request),
  );
});
