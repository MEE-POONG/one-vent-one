import { api, pagination, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { createEvent, listAdminEvents } from "@/server/services/event-admin";
import { createEventInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const GET = api(async (request) => {
  const actor = await requireActor(request);
  requireRoles(actor, "EVENT_MANAGER", "PAYMENT_REVIEWER", "CHECKIN_STAFF");
  const { page, pageSize } = pagination(request);
  const allowedEventIds = actor.roles.every(
    (r) => !["SUPER_ADMIN", "EVENT_MANAGER", "PAYMENT_REVIEWER"].includes(r),
  )
    ? actor.assignedEventIds
    : undefined;
  return listAdminEvents(
    page,
    pageSize,
    (new URL(request.url).searchParams.get("q") || "").slice(0, 160),
    allowedEventIds,
  );
});
export const POST = api(async (request) =>
  createEvent(
    await requireActor(request),
    await readJson(request, createEventInput),
    idempotencyKey(request),
  ),
);
