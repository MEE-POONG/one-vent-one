import { BookingPicker } from "@/features/booking/booking-picker";
export const metadata = { title: "เลือกโต๊ะและบัตร" };
export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <BookingPicker slug={(await params).slug} />;
}
