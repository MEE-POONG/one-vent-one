import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { createZone } from "@/server/services/event-admin";
import { objectId, zoneInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const POST = api(async (request, context) =>
  createZone(
    await requireActor(request),
    objectId.parse((await context.params).id),
    await readJson(request, zoneInput),
    idempotencyKey(request),
  ),
);
