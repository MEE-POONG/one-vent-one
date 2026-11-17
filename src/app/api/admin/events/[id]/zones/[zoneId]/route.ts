import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { deleteZone, updateZone } from "@/server/services/event-structure";
import {
  objectId,
  structureDeleteInput,
  zoneEditInput,
} from "@/shared/catalog";
export const runtime = "nodejs";
export const PATCH = api(async (request, context) => {
  const p = await context.params;
  return updateZone(
    await requireActor(request),
    objectId.parse(p.id),
    objectId.parse(p.zoneId),
    await readJson(request, zoneEditInput),
    idempotencyKey(request),
  );
});
export const DELETE = api(async (request, context) => {
  const p = await context.params;
  return deleteZone(
    await requireActor(request),
    objectId.parse(p.id),
    objectId.parse(p.zoneId),
    await readJson(request, structureDeleteInput),
    idempotencyKey(request),
  );
});
