import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { publishLayout } from "@/server/services/layout";
import { objectId } from "@/shared/catalog";
import { z } from "zod";
export const runtime = "nodejs";
export const POST = api(async (request, context) =>
  publishLayout(
    await requireActor(request),
    objectId.parse((await context.params).id),
    await readJson(request, z.object({ version: z.number().int().min(0) })),
    idempotencyKey(request),
  ),
);
