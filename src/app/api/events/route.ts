import { api, pagination } from "@/server/http";
import { getEventBySlug, listEvents } from "@/server/services/catalog";
export const runtime = "nodejs";
export const GET = api(async (request) => {
  const query = new URL(request.url).searchParams;
  const slug = query.get("slug");
  if (slug) return getEventBySlug(slug.slice(0, 100));
  const { page, pageSize } = pagination(request);
  return listEvents({
    q: (query.get("q") || "").slice(0, 160),
    page,
    pageSize,
  });
});
