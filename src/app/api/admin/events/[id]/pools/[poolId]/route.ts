import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { setPoolCapacity } from "@/server/services/event-admin";
import { objectId, poolInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const PATCH = api(async (request, context) => {
  const p = await context.params;
  return setPoolCapacity(
    await requireActor(request),
    objectId.parse(p.id),
    objectId.parse(p.poolId),
    await readJson(request, poolInput),
    idempotencyKey(request),
  );
});
