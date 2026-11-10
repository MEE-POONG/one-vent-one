import { InventoryEditor } from "@/features/admin/inventory";
export default async function InventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <InventoryEditor eventId={(await params).id} />;
}
