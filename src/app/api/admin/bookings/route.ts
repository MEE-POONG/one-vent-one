import { z } from "zod";
import { requireActor } from "@/server/auth";
import { api, pagination } from "@/server/http";
import { listBookings } from "@/server/services/booking";
import { objectIdSchema } from "@/shared/booking";
export const runtime = "nodejs";
export const GET = api(async (request) => {
  const query = new URL(request.url).searchParams;
  const filters = z
    .object({
      status: z
        .enum([
          "PENDING_PAYMENT",
          "PENDING_REVIEW",
          "ACTION_REQUIRED",
          "CONFIRMED",
          "EXPIRED",
          "REJECTED",
          "CANCELLED",
        ])
        .optional(),
      eventId: objectIdSchema.optional(),
      q: z.string().max(100).optional(),
    })
    .parse(
      Object.fromEntries(
        [...query].filter(
          ([key, value]) =>
            ["status", "eventId", "q"].includes(key) && value !== "",
        ),
      ),
    );
  return listBookings(
    await requireActor(request),
    pagination(request),
    true,
    filters,
  );
});
