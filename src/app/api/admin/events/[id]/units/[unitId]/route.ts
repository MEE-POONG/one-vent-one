import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { setUnitInventory } from "@/server/services/event-admin";
import { deleteUnit } from "@/server/services/event-structure";
import {
  objectId,
  inventoryInput,
  structureDeleteInput,
} from "@/shared/catalog";
export const runtime = "nodejs";
export const PATCH = api(async (request, context) => {
  const p = await context.params;
  return setUnitInventory(
    await requireActor(request),
    objectId.parse(p.id),
    objectId.parse(p.unitId),
    await readJson(request, inventoryInput),
    idempotencyKey(request),
  );
});
export const DELETE = api(async (request, context) => {
  const p = await context.params;
  return deleteUnit(
    await requireActor(request),
    objectId.parse(p.id),
    objectId.parse(p.unitId),
    await readJson(request, structureDeleteInput),
    idempotencyKey(request),
  );
});
