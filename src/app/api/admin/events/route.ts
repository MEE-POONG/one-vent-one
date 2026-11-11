import { api, pagination, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { createEvent, listAdminEvents } from "@/server/services/event-admin";
import { createEventInput } from "@/shared/catalog";
import { z } from "zod";
export const runtime = "nodejs";
const eventStatus = z
  .enum(["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED", "COMPLETED"])
  .optional();
export const GET = api(async (request) => {
  const actor = await requireActor(request);
  requireRoles(actor, "ADMIN");
  const { page, pageSize } = pagination(request);
  const query = new URL(request.url).searchParams;
  const status = eventStatus.parse(query.get("status") || undefined);
  return listAdminEvents(
    page,
    pageSize,
    (query.get("q") || "").slice(0, 160),
    status,
  );
});
export const POST = api(async (request) =>
  createEvent(
    await requireActor(request),
    await readJson(request, createEventInput),
    idempotencyKey(request),
  ),
);
