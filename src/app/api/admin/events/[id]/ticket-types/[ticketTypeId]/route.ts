import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import {
  deleteTicketType,
  updateTicketType,
} from "@/server/services/event-structure";
import {
  objectId,
  structureDeleteInput,
  ticketTypeEditInput,
} from "@/shared/catalog";
export const runtime = "nodejs";
export const PATCH = api(async (request, context) => {
  const p = await context.params;
  return updateTicketType(
    await requireActor(request),
    objectId.parse(p.id),
    objectId.parse(p.ticketTypeId),
    await readJson(request, ticketTypeEditInput),
    idempotencyKey(request),
  );
});
export const DELETE = api(async (request, context) => {
  const p = await context.params;
  return deleteTicketType(
    await requireActor(request),
    objectId.parse(p.id),
    objectId.parse(p.ticketTypeId),
    await readJson(request, structureDeleteInput),
    idempotencyKey(request),
  );
});
