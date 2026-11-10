import { requireActor } from "@/server/auth";
import { api, idempotencyKey, readJson } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { createBookingSchema } from "@/shared/booking";
import { createBooking } from "@/server/services/booking";
export const runtime = "nodejs";
export const POST = api(async (request) => {
  const actor = await requireActor(request);
  await rateLimit(actor.id, "booking", 30);
  return createBooking(
    actor,
    await readJson(request, createBookingSchema),
    idempotencyKey(request),
  );
});
