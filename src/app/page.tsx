import { getBusinessProfile, listEvents } from "@/server/services/catalog";
import { Home } from "@/components/home";
import type { EventData } from "@/lib/client-types";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const [businessResult, eventsResult] = await Promise.allSettled([
    getBusinessProfile(),
    listEvents({ pageSize: 18 }),
  ]);
  const business =
    businessResult.status === "fulfilled" ? businessResult.value : null;
  const events: EventData[] =
    eventsResult.status === "fulfilled"
      ? JSON.parse(JSON.stringify(eventsResult.value.items))
      : [];
  return <Home events={events} venueName={business?.displayName ?? "Mongkol Bar"} />;
}
