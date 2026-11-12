import { TicketVerificationView } from "@/features/tickets/verified-ticket-card";

export const metadata = {
  title: "ตรวจสอบบัตรเข้างาน · OneVentOne",
};

export default async function TicketVerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <TicketVerificationView token={decodeURIComponent(token)} />;
}

