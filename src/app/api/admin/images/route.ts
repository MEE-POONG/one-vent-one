import { z } from "zod";
import { requireActor } from "@/server/auth";
import { invariant } from "@/server/errors";
import { api, readBody } from "@/server/http";
import { requireRoles } from "@/server/permissions";
import { rateLimit } from "@/server/rate-limit";
import { uploadPublicImage } from "@/server/storage/public-images";

export const runtime = "nodejs";

export const POST = api(async (request) => {
  const actor = await requireActor(request);
  requireRoles(actor, "ADMIN");
  await rateLimit(actor.id, "public-image-upload", 12);
  const type = request.headers.get("content-type") || "";
  invariant(
    type.startsWith("multipart/form-data;"),
    "VALIDATION_ERROR",
    "กรุณาส่งไฟล์รูปภาพ",
    422,
  );
  const data = await new Response(
    new Uint8Array(await readBody(request, 5 * 1024 * 1024 + 64 * 1024)).buffer,
    { headers: { "content-type": type } },
  ).formData();
  const kind = z.enum(["poster", "logo"]).parse(data.get("kind"));
  const file = data.get("file");
  invariant(
    file instanceof File,
    "VALIDATION_ERROR",
    "กรุณาเลือกไฟล์รูปภาพ",
    422,
  );
  return uploadPublicImage(actor, kind, file);
});
