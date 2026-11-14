import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import {
  createUnitsBatch,
  editUnitsBatchPrice,
} from "@/server/services/event-admin";
import {
  objectId,
  batchUnitInput,
  batchPriceEditInput,
} from "@/shared/catalog";

export const runtime = "nodejs";

export const POST = api(async (request, context) =>
  createUnitsBatch(
    await requireActor(request),
    objectId.parse((await context.params).id),
    await readJson(request, batchUnitInput),
    idempotencyKey(request),
  ),
);

export const PATCH = api(async (request, context) =>
  editUnitsBatchPrice(
    await requireActor(request),
    objectId.parse((await context.params).id),
    await readJson(request, batchPriceEditInput),
    idempotencyKey(request),
  ),
);

