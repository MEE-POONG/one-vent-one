import { api } from "@/server/http";
import { getEventById } from "@/server/services/catalog";
import { objectId } from "@/shared/catalog";
export const runtime = "nodejs";
export const GET = api(async (_, context) =>
  getEventById(objectId.parse((await context.params).id)),
);
