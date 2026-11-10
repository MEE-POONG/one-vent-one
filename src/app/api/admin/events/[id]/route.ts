import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { adminEvent, editEvent } from "@/server/services/event-admin";
import { objectId, editEventInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const GET = api(async (request, context) => {
  const actor = await requireActor(request);
  requireRoles(actor, "EVENT_MANAGER", "PAYMENT_REVIEWER");
  return adminEvent(objectId.parse((await context.params).id));
});
export const PATCH = api(async (request, context) =>
  editEvent(
    await requireActor(request),
    objectId.parse((await context.params).id),
    await readJson(request, editEventInput),
    idempotencyKey(request),
  ),
);
