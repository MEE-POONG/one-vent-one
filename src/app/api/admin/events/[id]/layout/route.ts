import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { getDraftLayout, saveLayout } from "@/server/services/layout";
import { objectId, layoutInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const GET = api(async (request, context) => {
  requireRoles(await requireActor(request), "ADMIN");
  return getDraftLayout(objectId.parse((await context.params).id));
});
export const PUT = api(async (request, context) =>
  saveLayout(
    await requireActor(request),
    objectId.parse((await context.params).id),
    await readJson(request, layoutInput),
    idempotencyKey(request),
  ),
);
