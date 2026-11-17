import { requireCustomerOrGuestActor } from "@/server/auth";
import { api, readBody, idempotencyKey } from "@/server/http";
import { invariant } from "@/server/errors";
import { objectIdSchema } from "@/shared/booking";
import { uploadEvidence } from "@/server/storage";
import { rateLimit } from "@/server/rate-limit";
export const runtime = "nodejs";
export const POST = api(async (request, context) => {
  const actor = await requireCustomerOrGuestActor(request);
  await rateLimit(actor.id, "upload", 12);
  const key = idempotencyKey(request);
  const type = request.headers.get("content-type") || "";
  invariant(
    type.startsWith("multipart/form-data;"),
    "VALIDATION_ERROR",
    "ต้องส่งไฟล์เป็น multipart/form-data",
    422,
  );
  const data = await new Response(
    new Uint8Array(await readBody(request, 5 * 1024 * 1024 + 64 * 1024)).buffer,
    { headers: { "content-type": type } },
  ).formData();
  const file = data.get("file");
  invariant(
    file instanceof File,
    "VALIDATION_ERROR",
    "กรุณาเลือกไฟล์หลักฐาน",
    422,
  );
  return uploadEvidence(
    actor,
    objectIdSchema.parse((await context.params).id),
    file,
    key,
  );
});
