import { api } from "@/server/http";
import { inspectTicketByToken } from "@/server/services/ticket";

export const runtime = "nodejs";

export const GET = api(async (_request, context) => {
  const { token } = await context.params;
  return inspectTicketByToken(decodeURIComponent(token || ""));
});

