import { api } from "@/server/http";
import { getBusinessProfile } from "@/server/services/catalog";
export const runtime = "nodejs";
export const GET = api(async () => getBusinessProfile());
