import { requireCustomerOrGuestActor } from "@/server/auth";
import { api } from "@/server/http";
import { objectIdSchema } from "@/shared/booking";
import { getTickets } from "@/server/services/ticket";
export const runtime = "nodejs";
export const GET = api(async (request, context) =>
  getTickets(
    await requireCustomerOrGuestActor(request),
    objectIdSchema.parse((await context.params).id),
  ),
);
