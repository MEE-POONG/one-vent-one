import { requireActor } from "@/server/auth";
import { api, readJson, idempotencyKey } from "@/server/http";
import { approvalSchema, objectIdSchema } from "@/shared/booking";
import { approveBooking } from "@/server/services/payment";
import { requireRoles } from "@/server/permissions";
export const runtime = "nodejs";
export const POST = api(async (request, context) => {
  const actor = await requireActor(request);
  requireRoles(actor, "ADMIN");
  return approveBooking(
    actor,
    objectIdSchema.parse((await context.params).id),
    await readJson(request, approvalSchema),
    idempotencyKey(request),
  );
});
