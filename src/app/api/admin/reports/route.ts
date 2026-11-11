import { api } from "@/server/http";
import { requireActor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { getReports } from "@/server/services/administration";
import { objectId } from "@/shared/catalog";
export const runtime = "nodejs";
export const GET = api(async (request) => {
  requireRoles(
    await requireActor(request),
    "ADMIN",
  );
  const eventId = new URL(request.url).searchParams.get("eventId");
  return getReports(eventId ? objectId.parse(eventId) : undefined);
});
