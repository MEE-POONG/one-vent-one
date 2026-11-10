import { api, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { updateBusiness } from "@/server/services/administration";
import { getBusinessProfile } from "@/server/services/catalog";
import { businessInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const GET = api(async (request) => {
  requireRoles(await requireActor(request), "SUPER_ADMIN");
  return getBusinessProfile();
});
export const PATCH = api(async (request) =>
  updateBusiness(
    await requireActor(request),
    await readJson(request, businessInput),
    idempotencyKey(request),
  ),
);
