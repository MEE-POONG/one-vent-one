import { BookingPicker } from "@/features/booking/booking-picker";
import { redirect } from "next/navigation";
import { requireActor } from "@/server/auth";
import { DomainError } from "@/server/errors";
export const metadata = { title: "เลือกโต๊ะและบัตร" };
export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    await requireActor();
  } catch (error) {
    if (!(error instanceof DomainError) || error.status !== 401) throw error;
    redirect(
      `/login?next=${encodeURIComponent(`/events/${encodeURIComponent(slug)}/booking`)}`,
    );
  }
  return <BookingPicker slug={slug} />;
}
