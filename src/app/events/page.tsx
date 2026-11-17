import { EventList } from "@/features/events/event-list";
export const metadata = { title: "อีเวนท์" };
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  return <EventList key={q} initialQuery={q} />;
}
