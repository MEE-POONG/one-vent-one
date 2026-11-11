import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { duplicateEvent } from "@/server/services/event-structure";
import { objectId, createEventInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const POST = api(async (request, context) =>
  duplicateEvent(
    await requireActor(request),
    objectId.parse((await context.params).id),
    await readJson(request, createEventInput),
    idempotencyKey(request),
  ),
);
