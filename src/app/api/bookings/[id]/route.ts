import { requireCustomerOrGuestActor } from "@/server/auth";
import { api } from "@/server/http";
import { objectIdSchema } from "@/shared/booking";
import { getBooking } from "@/server/services/booking";
export const runtime = "nodejs";
export const GET = api(async (request, context) =>
  getBooking(
    await requireCustomerOrGuestActor(request),
    objectIdSchema.parse((await context.params).id),
  ),
);
