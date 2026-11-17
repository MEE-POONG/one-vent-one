import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { editPrice } from "@/server/services/event-admin";
import { objectId, priceEditInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const PATCH = api(async (request, context) => {
  const p = await context.params;
  return editPrice(
    await requireActor(request),
    objectId.parse(p.id),
    objectId.parse(p.ticketTypeId),
    "ticketType",
    await readJson(request, priceEditInput),
    idempotencyKey(request),
  );
});
