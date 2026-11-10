import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { createUnit } from "@/server/services/event-admin";
import { objectId, unitInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const POST = api(async (request, context) =>
  createUnit(
    await requireActor(request),
    objectId.parse((await context.params).id),
    await readJson(request, unitInput),
    idempotencyKey(request),
  ),
);
