import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { changeEventStatus } from "@/server/services/event-admin";
import { objectId, versionInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const POST = api(async (request, context) =>
  changeEventStatus(
    await requireActor(request),
    objectId.parse((await context.params).id),
    "PUBLISHED",
    await readJson(request, versionInput),
    idempotencyKey(request),
  ),
);
