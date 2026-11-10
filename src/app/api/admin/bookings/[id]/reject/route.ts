import { requireActor } from "@/server/auth";
import { api, readJson, idempotencyKey } from "@/server/http";
import { actionSchema, objectIdSchema } from "@/shared/booking";
import { cancelBooking } from "@/server/services/booking";
import { requireRoles } from "@/server/permissions";
export const runtime = "nodejs";
export const POST = api(async (request, context) => {
  const actor = await requireActor(request);
  requireRoles(actor, "PAYMENT_REVIEWER");
  return cancelBooking(
    actor,
    objectIdSchema.parse((await context.params).id),
    await readJson(request, actionSchema),
    idempotencyKey(request),
    { reject: true },
  );
});
