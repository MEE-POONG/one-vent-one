import { requireActor } from "@/server/auth";
import { api } from "@/server/http";
import { objectIdSchema } from "@/shared/booking";
import { privateAsset } from "@/server/storage";
export const runtime = "nodejs";
export const GET = api(async (request, context) =>
  privateAsset(
    await requireActor(request),
    objectIdSchema.parse((await context.params).id),
  ),
);
