import { api, pagination } from "@/server/http";
import { requireActor } from "@/server/auth";
import { requireRoles } from "@/server/permissions";
import { prisma } from "@/server/db";
export const runtime = "nodejs";
export const GET = api(async (request) => {
  requireRoles(await requireActor(request), "SUPER_ADMIN");
  const { page, pageSize, skip } = pagination(request);
  const entityId = new URL(request.url).searchParams.get("entityId");
  const where = entityId ? { entityId: entityId.slice(0, 100) } : {};
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, page, pageSize };
});
