import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { adminEvent, editEvent } from "@/server/services/event-admin";
import { deleteEvent } from "@/server/services/event-structure";
import { objectId, editEventInput, versionInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const GET = api(async (request, context) => {
  const actor = await requireActor(request);
  requireRoles(actor, "ADMIN");
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
export const DELETE = api(async (request, context) =>
  deleteEvent(
    await requireActor(request),
    objectId.parse((await context.params).id),
    await readJson(request, versionInput),
    idempotencyKey(request),
  ),
);
