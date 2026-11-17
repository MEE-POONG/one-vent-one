import { api } from "@/server/http";
import { publicImage } from "@/server/storage/public-images";

export const runtime = "nodejs";

export const GET = api(async (_request, context) => {
  const { key } = await context.params;
  return publicImage(key);
});
