import { EventEditor } from "@/features/admin/events";
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;
  const source =
    typeof from === "string" && /^[0-9a-f]{24}$/i.test(from) ? from : undefined;
  return <EventEditor key={source ?? "new"} from={source} />;
}
