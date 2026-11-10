import { requireActor } from "@/server/auth";
import { api, pagination } from "@/server/http";
import { listBookings } from "@/server/services/booking";
export const runtime = "nodejs";
export const GET = api(async (request) =>
  listBookings(await requireActor(request), pagination(request)),
);
