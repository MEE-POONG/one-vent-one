import { requireCustomerOrGuestActor } from "@/server/auth";
import { api, readJson, idempotencyKey } from "@/server/http";
import { actionSchema, objectIdSchema } from "@/shared/booking";
import { cancelBooking } from "@/server/services/booking";
export const runtime = "nodejs";
export const POST = api(async (request, context) =>
  cancelBooking(
    await requireCustomerOrGuestActor(request),
    objectIdSchema.parse((await context.params).id),
    await readJson(request, actionSchema),
    idempotencyKey(request),
  ),
);
