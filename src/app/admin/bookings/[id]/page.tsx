import { AdminBookingDetail } from "@/features/admin/bookings";
export default async function BookingReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <AdminBookingDetail id={(await params).id} />;
}
