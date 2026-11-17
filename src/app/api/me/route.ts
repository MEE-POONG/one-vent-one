import { z } from "zod";
import { api, readJson } from "@/server/http";
import { requireActor } from "@/server/auth";
import { prisma } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
export const runtime = "nodejs";
export const GET = api(async (request) => {
  const actor = await requireActor(request);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { name: true, email: true },
  });
  return { ...actor, ...user };
});

const profileInput = z
  .object({
    name: z.string().trim().min(2, "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร").max(80),
  })
  .strict();

export const PATCH = api(async (request) => {
  const actor = await requireActor(request);
  const input = await readJson(request, profileInput);
  await rateLimit(actor.id, "profile.update", 20);
  const user = await prisma.user.update({
    where: { id: actor.id },
    data: { name: input.name },
    select: { name: true, email: true },
  });
  return { ...actor, ...user };
});
