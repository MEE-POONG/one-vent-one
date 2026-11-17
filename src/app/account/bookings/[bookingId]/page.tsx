import { BookingDetail } from "@/features/booking/booking-detail";
export default async function AccountBookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  return <BookingDetail bookingId={(await params).bookingId} />;
}
