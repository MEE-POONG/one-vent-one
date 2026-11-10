import { BookingDetail } from "@/features/booking/booking-detail";
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  return <BookingDetail bookingId={(await params).bookingId} checkout />;
}
