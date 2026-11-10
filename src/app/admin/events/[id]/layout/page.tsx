import { LayoutEditor } from "@/features/admin/layout-editor";
export default async function EventLayoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <LayoutEditor eventId={(await params).id} />;
}
