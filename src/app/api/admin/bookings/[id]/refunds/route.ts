import { requireActor } from "@/server/auth";
import { api, readJson, idempotencyKey } from "@/server/http";
import { actionSchema, objectIdSchema } from "@/shared/booking";
import { createRefund } from "@/server/services/refund";
export const runtime = "nodejs";
export const POST = api(async (request, context) =>
  createRefund(
    await requireActor(request),
    objectIdSchema.parse((await context.params).id),
    await readJson(request, actionSchema),
    idempotencyKey(request),
  ),
);
