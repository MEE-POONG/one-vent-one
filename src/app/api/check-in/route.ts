import { requireActor } from "@/server/auth";
import { api, readJson, idempotencyKey } from "@/server/http";
import { checkInSchema } from "@/shared/booking";
import { checkIn } from "@/server/services/checkin";
import { rateLimit } from "@/server/rate-limit";
export const runtime = "nodejs";
export const POST = api(async (request) => {
  const actor = await requireActor(request);
  await rateLimit(actor.id, "check-in", 180);
  return checkIn(
    actor,
    await readJson(request, checkInSchema),
    idempotencyKey(request),
  );
});
