import { EventEditor } from "@/features/admin/events";
export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EventEditor id={(await params).id} />;
}
