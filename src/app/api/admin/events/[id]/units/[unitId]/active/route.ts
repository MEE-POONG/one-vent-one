import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { setUnitActive } from "@/server/services/event-admin";
import { objectId, unitActivationInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const PATCH = api(async (request, context) => {
  const p = await context.params;
  return setUnitActive(
    await requireActor(request),
    objectId.parse(p.id),
    objectId.parse(p.unitId),
    await readJson(request, unitActivationInput),
    idempotencyKey(request),
  );
});
