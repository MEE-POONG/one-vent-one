import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { createTicketType } from "@/server/services/event-admin";
import { objectId, ticketTypeInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const POST = api(async (request, context) =>
  createTicketType(
    await requireActor(request),
    objectId.parse((await context.params).id),
    await readJson(request, ticketTypeInput),
    idempotencyKey(request),
  ),
);
