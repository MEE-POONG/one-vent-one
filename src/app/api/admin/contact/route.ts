import { api, idempotencyKey, readJson } from "@/server/http";
import { requireActor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { getBusinessProfile } from "@/server/services/catalog";
import { updateContact } from "@/server/services/administration";
import { contactInput } from "@/shared/contact";
export const runtime = "nodejs";
export const GET = api(async (request) => {
  requireRoles(await requireActor(request), "SUPER_ADMIN");
  const profile = await getBusinessProfile();
  return { contact: profile.contact };
});
export const PATCH = api(async (request) =>
  updateContact(
    await requireActor(request),
    await readJson(request, contactInput),
    idempotencyKey(request),
  ),
);
