import "server-only";
import type { Actor } from "@/server/auth";
import { invariant } from "@/server/errors";
import { requireRoles } from "@/server/permissions";
import type { ActionInput, CompleteRefundInput } from "@/shared/booking";
import { ownedBooking } from "./booking";
import { idempotent } from "./idempotency";

export async function createRefund(
  actor: Actor,
  bookingId: string,
  input: ActionInput,
  key: string,
) {
  requireRoles(actor, "PAYMENT_REVIEWER");
  return idempotent(
    actor.id,
    `refund.create:${bookingId}`,
    key,
    input,
    async (tx) => {
      const booking = await ownedBooking(tx, actor, bookingId, true);
      invariant(
        ["CANCELLED", "REJECTED", "EXPIRED"].includes(booking.status) &&
          booking.verifiedPaymentId &&
          booking.verifiedAmountSatang > 0,
        "INVALID_TRANSITION",
        "ต้องมีเงินรับจริงและรายการจองสิ้นสุดก่อนสร้างรายการคืนเงิน",
      );
      const existing = await tx.refundRecord.findUnique({
        where: { bookingId },
      });
      if (existing) return existing;
      invariant(
        booking.version === input.version,
        "CONFLICT",
        "รายการเปลี่ยนแปลง กรุณาโหลดใหม่",
      );
      const refund = await tx.refundRecord.create({
        data: {
          bookingId,
          paymentId: booking.verifiedPaymentId,
          amountSatang: booking.verifiedAmountSatang,
          reason: input.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "REFUND_REQUESTED",
          entity: "Booking",
          entityId: bookingId,
          reason: input.reason,
          changes: { amountSatang: refund.amountSatang },
        },
      });
      return refund;
    },
  );
}

export async function completeRefund(
  actor: Actor,
  bookingId: string,
  refundId: string,
  input: CompleteRefundInput,
  key: string,
) {
  requireRoles(actor, "PAYMENT_REVIEWER");
  return idempotent(
    actor.id,
    `refund.complete:${refundId}`,
    key,
    input,
    async (tx) => {
      const booking = await ownedBooking(tx, actor, bookingId, true);
      const refund = await tx.refundRecord.findUnique({
        where: { id: refundId },
      });
      invariant(
        refund && refund.bookingId === bookingId && refund.status === "PENDING",
        "INVALID_TRANSITION",
        "รายการคืนเงินนี้ไม่อยู่ระหว่างดำเนินการ",
      );
      invariant(
        ["CANCELLED", "REJECTED", "EXPIRED"].includes(booking.status) &&
          refund.amountSatang === booking.verifiedAmountSatang &&
          refund.paymentId === booking.verifiedPaymentId,
        "INVALID_TRANSITION",
        "ยอดคืนต้องเท่ากับยอดเงินรับจริงทั้งหมด",
      );
      const asset = await tx.mediaAsset.findUnique({
        where: { id: input.proofAssetId },
      });
      invariant(
        asset &&
          asset.bookingId === bookingId &&
          asset.ownerId === actor.id &&
          asset.visibility === "PRIVATE" &&
          asset.uploadStatus === "COMPLETE",
        "VALIDATION_ERROR",
        "หลักฐานการคืนเงินไม่ถูกต้อง",
        422,
      );
      const changed = await tx.refundRecord.updateMany({
        where: { id: refundId, status: "PENDING" },
        data: {
          status: "REFUNDED",
          proofAssetId: asset.id,
          operatorId: actor.id,
          completedAt: new Date(),
          reason: input.reason,
        },
      });
      invariant(
        changed.count === 1,
        "CONFLICT",
        "รายการคืนเงินนี้ถูกเปลี่ยนแปลงแล้ว",
      );
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "EXTERNAL_REFUND_RECORDED",
          entity: "Booking",
          entityId: bookingId,
          reason: input.reason,
          changes: { refundId, amountSatang: refund.amountSatang },
        },
      });
      return tx.refundRecord.findUniqueOrThrow({ where: { id: refundId } });
    },
  );
}
