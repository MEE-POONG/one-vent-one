import { api, pagination, readJson, idempotencyKey } from "@/server/http";
import { requireActor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { listStaff, updateStaff } from "@/server/services/administration";
import { staffInput } from "@/shared/catalog";
export const runtime = "nodejs";
export const GET = api(async (request) => {
  requireRoles(await requireActor(request), "SUPER_ADMIN");
  const { page, pageSize } = pagination(request);
  return listStaff(
    (new URL(request.url).searchParams.get("q") || "").slice(0, 160),
    page,
    pageSize,
  );
});
export const POST = api(async (request) =>
  updateStaff(
    await requireActor(request),
    await readJson(request, staffInput),
    idempotencyKey(request),
  ),
);
