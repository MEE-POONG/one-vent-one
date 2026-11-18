import { requireActor } from "@/server/auth";
import { api, pagination } from "@/server/http";
import { listBookings } from "@/server/services/booking";
export const runtime = "nodejs";
export const GET = api(async (request) => {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId")?.trim() || undefined;
  return listBookings(await requireActor(request), pagination(request), false, {
    eventId,
  });
});
