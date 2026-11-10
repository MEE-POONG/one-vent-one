import { api } from "@/server/http";
import { getAvailability } from "@/server/services/catalog";
import { objectId } from "@/shared/catalog";
export const runtime = "nodejs";
export const GET = api(async (_, context) =>
  getAvailability(objectId.parse((await context.params).id)),
);
