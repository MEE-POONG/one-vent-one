import { api } from "@/server/http";
import { requireActor } from "@/server/auth";
import { prisma } from "@/server/db";
export const runtime = "nodejs";
export const GET = api(async (request) => {
  const actor = await requireActor(request);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { name: true, email: true },
  });
  return { ...actor, ...user };
});
