import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { cancelEventBatch } from "@/server/services/event-cancellation";
import { objectId, versionInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const POST = api(async (request, context) =>
  cancelEventBatch(
    await requireActor(request),
    objectId.parse((await context.params).id),
    await readJson(request, versionInput),
    idempotencyKey(request),
  ),
);
