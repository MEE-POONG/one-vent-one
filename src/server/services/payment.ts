import "server-only";
import type { Actor } from "@/server/auth";
import { invariant } from "@/server/errors";
import { requireRoles } from "@/server/permissions";
import type {
  ActionInput,
  ApprovalInput,
  PaymentInput,
} from "@/shared/booking";
import { bookingResult, ownedBooking } from "./booking";
import { idempotent } from "./idempotency";
import { moveInventory } from "./inventory";
import { issueTickets } from "./ticket";

/** Simulate a provider success for demo bookings only; never record real revenue. */
export async function confirmDemoPayment(
  actor: Actor,
  id: string,
  key: string,
) {
  return idempotent(actor.id, `payment.demo:${id}`, key, {}, async (tx) => {
    const booking = await ownedBooking(tx, actor, id);
    const snapshot = booking.snapshot as { paymentMode?: string };
    invariant(
      snapshot.paymentMode === "DEMO_QR",
      "INVALID_TRANSITION",
      "รายการนี้ไม่ใช่การชำระเงินเดโม",
    );
    // A retry with a new request key must not issue another set of tickets.
    if (booking.status === "CONFIRMED") return bookingResult(tx, id);
    invariant(
      booking.status !== "EXPIRED" && booking.holdExpiresAt > new Date(),
      "HOLD_EXPIRED",
      "QR หมดอายุแล้ว กรุณาจองใหม่",
    );
    invariant(
      booking.status === "PENDING_PAYMENT",
      "INVALID_TRANSITION",
      "รายการนี้ไม่สามารถชำระเงินได้",
    );
    const event = await tx.event.findUniqueOrThrow({
      where: { id: booking.eventId },
    });
    invariant(
      ["PUBLISHED", "CLOSED"].includes(event.status) &&
        event.endsAt > new Date(),
      "INVALID_TRANSITION",
      "งานนี้ไม่อยู่ในสถานะที่ออกบัตรได้",
    );
    const fence = await tx.event.updateMany({
      where: { id: event.id, version: event.version, status: event.status },
      data: { version: { increment: 1 } },
    });
    invariant(
      fence.count === 1,
      "CONFLICT",
      "สถานะงานเปลี่ยนแปลง กรุณาลองใหม่",
    );
    const now = new Date();
    const changed = await tx.booking.updateMany({
      where: {
        id,
        version: booking.version,
        status: "PENDING_PAYMENT",
        holdExpiresAt: { gt: now },
      },
      data: {
        status: "CONFIRMED",
        confirmedAt: now,
        version: { increment: 1 },
      },
    });
    invariant(
      changed.count === 1,
      "HOLD_EXPIRED",
      "QR หมดอายุหรือสถานะรายการเปลี่ยนแปลง กรุณาโหลดใหม่",
    );
    await moveInventory(tx, booking, "HELD", "SOLD");
    await issueTickets(tx, id);
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "DEMO_PAYMENT_CONFIRMED",
        entity: "Booking",
        entityId: id,
        reason: "จำลองชำระเงินสำเร็จ ไม่มีการรับเงินจริง",
        changes: { simulatedAmountSatang: booking.totalSatang },
      },
    });
    return bookingResult(tx, id);
  });
}

export async function submitPayment(
  actor: Actor,
  id: string,
  input: PaymentInput,
  key: string,
) {
  return idempotent(
    actor.id,
    `payment.submit:${id}`,
    key,
    input,
    async (tx) => {
      const now = new Date();
      const booking = await ownedBooking(tx, actor, id);
      invariant(
        ["PENDING_PAYMENT", "ACTION_REQUIRED"].includes(booking.status),
        booking.status === "EXPIRED" ? "HOLD_EXPIRED" : "INVALID_TRANSITION",
        booking.status === "EXPIRED"
          ? "หมดเวลาการจองแล้ว กรุณาติดต่อร้านเพื่อตรวจสอบเงินที่โอน"
          : "รายการนี้ไม่อยู่ในสถานะส่งหลักฐาน",
      );
      invariant(
        booking.status !== "PENDING_PAYMENT" || booking.holdExpiresAt > now,
        "HOLD_EXPIRED",
        "หมดเวลาการจองแล้ว กรุณาติดต่อร้านเพื่อตรวจสอบเงินที่โอน",
      );
      const asset = await tx.mediaAsset.findUnique({
        where: { id: input.assetId },
      });
      invariant(
        asset &&
          asset.ownerId === actor.id &&
          asset.bookingId === id &&
          asset.visibility === "PRIVATE" &&
          asset.uploadStatus === "COMPLETE",
        "VALIDATION_ERROR",
        "หลักฐานไม่สมบูรณ์หรือไม่ได้เป็นของรายการนี้",
        422,
      );
      invariant(
        new Date(input.transferTime).getTime() <= now.getTime() + 5 * 60_000,
        "VALIDATION_ERROR",
        "เวลาโอนเงินต้องไม่อยู่ในอนาคต",
        422,
      );
      const business = await tx.businessProfile.findUniqueOrThrow({
        where: { key: "primary" },
      });
      const changed = await tx.booking.updateMany({
        where: {
          id,
          version: booking.version,
          status: booking.status,
          ...(booking.status === "PENDING_PAYMENT"
            ? { holdExpiresAt: { gt: now } }
            : {}),
        },
        data: {
          status: "PENDING_REVIEW",
          version: { increment: 1 },
          reviewDueAt: new Date(
            now.getTime() + business.reviewHours * 3_600_000,
          ),
          correctionDueAt: null,
          reason: null,
        },
      });
      invariant(
        changed.count === 1,
        "CONFLICT",
        "สถานะรายการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่",
      );
      if (booking.status === "PENDING_PAYMENT")
        await moveInventory(tx, booking, "HELD", "REVIEW_RESERVED");
      const duplicateAssetCount = await tx.mediaAsset.count({
        where: { contentHash: asset.contentHash, id: { not: asset.id } },
      });
      const priorEvidenceCount = await tx.paymentAttempt.count({
        where: { asset: { contentHash: asset.contentHash } },
      });
      const duplicateEvidenceWarning =
        duplicateAssetCount > 0 || priorEvidenceCount > 0;
      await tx.paymentAttempt.create({
        data: {
          bookingId: id,
          assetId: input.assetId,
          declaredAmountSatang: input.declaredAmountSatang,
          transferTime: new Date(input.transferTime),
          duplicateEvidenceWarning,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "PAYMENT_SUBMITTED",
          entity: "Booking",
          entityId: id,
          changes: { duplicateEvidenceWarning },
        },
      });
      return bookingResult(tx, id);
    },
  );
}

export async function approveBooking(
  actor: Actor,
  id: string,
  input: ApprovalInput,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(
    actor.id,
    `payment.approve:${id}`,
    key,
    input,
    async (tx) => {
      const booking = await ownedBooking(tx, actor, id, true);
      invariant(
        booking.status === "PENDING_REVIEW",
        "INVALID_TRANSITION",
        "อนุมัติได้เฉพาะรายการที่รอตรวจสอบ",
      );
      invariant(
        booking.version === input.version,
        "CONFLICT",
        "รายการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่",
      );
      invariant(
        input.receivedAmountSatang === booking.totalSatang &&
          !booking.verifiedPaymentId &&
          booking.verifiedAmountSatang === 0,
        "VALIDATION_ERROR",
        "ยอดเงินรับจริงต้องตรงกับยอดจองเต็มจำนวน",
        422,
      );
      const event = await tx.event.findUniqueOrThrow({
        where: { id: booking.eventId },
      });
      invariant(
        ["PUBLISHED", "CLOSED"].includes(event.status) &&
          event.endsAt > new Date(),
        "INVALID_TRANSITION",
        "งานนี้ไม่อยู่ในสถานะที่ออกบัตรได้",
      );
      const fence = await tx.event.updateMany({
        where: { id: event.id, version: event.version, status: event.status },
        data: { version: { increment: 1 } },
      });
      invariant(
        fence.count === 1,
        "CONFLICT",
        "สถานะงานเปลี่ยนแปลง กรุณาโหลดใหม่",
      );
      const payment = await tx.paymentAttempt.findUnique({
        where: { id: input.paymentAttemptId },
      });
      invariant(
        payment && payment.bookingId === id && payment.status === "SUBMITTED",
        "INVALID_TRANSITION",
        "หลักฐานนี้ไม่อยู่ในคิวตรวจสอบ",
      );
      const changed = await tx.booking.updateMany({
        where: { id, version: input.version, status: "PENDING_REVIEW" },
        data: {
          status: "CONFIRMED",
          version: { increment: 1 },
          confirmedAt: new Date(),
          verifiedPaymentId: payment.id,
          verifiedAmountSatang: input.receivedAmountSatang,
          reason: input.reason,
        },
      });
      invariant(
        changed.count === 1,
        "CONFLICT",
        "รายการเปลี่ยนแปลง กรุณาโหลดใหม่",
      );
      await tx.paymentAttempt.update({
        where: { id: payment.id },
        data: {
          status: "VERIFIED",
          reviewerId: actor.id,
          reviewedAt: new Date(),
          receivedAmountSatang: input.receivedAmountSatang,
          reviewReason: input.reason,
        },
      });
      await moveInventory(tx, booking, "REVIEW_RESERVED", "SOLD");
      await issueTickets(tx, id);
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "PAYMENT_VERIFIED",
          entity: "Booking",
          entityId: id,
          reason: input.reason,
          changes: {
            paymentAttemptId: payment.id,
            receivedAmountSatang: input.receivedAmountSatang,
          },
        },
      });
      return bookingResult(tx, id);
    },
  );
}

export async function requestCorrection(
  actor: Actor,
  id: string,
  input: ActionInput,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(
    actor.id,
    `payment.correction:${id}`,
    key,
    input,
    async (tx) => {
      const booking = await ownedBooking(tx, actor, id, true);
      invariant(
        booking.version === input.version &&
          booking.status === "PENDING_REVIEW",
        "INVALID_TRANSITION",
        "รายการเปลี่ยนแปลงหรือไม่อยู่ในคิวตรวจสอบ",
      );
      const business = await tx.businessProfile.findUniqueOrThrow({
        where: { key: "primary" },
      });
      const changed = await tx.booking.updateMany({
        where: { id, version: input.version, status: "PENDING_REVIEW" },
        data: {
          status: "ACTION_REQUIRED",
          reason: input.reason,
          version: { increment: 1 },
          correctionDueAt: new Date(
            Date.now() + business.correctionHours * 3_600_000,
          ),
        },
      });
      invariant(
        changed.count === 1,
        "CONFLICT",
        "รายการเปลี่ยนแปลง กรุณาโหลดใหม่",
      );
      await tx.paymentAttempt.updateMany({
        where: { bookingId: id, status: "SUBMITTED" },
        data: {
          status: "REJECTED",
          reviewerId: actor.id,
          reviewedAt: new Date(),
          reviewReason: input.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "PAYMENT_CORRECTION_REQUESTED",
          entity: "Booking",
          entityId: id,
          reason: input.reason,
        },
      });
      return bookingResult(tx, id);
    },
  );
}

/** Record real money on a terminal booking without reviving stock or issuing tickets. */
export async function recordLateReceipt(
  actor: Actor,
  id: string,
  input: PaymentInput & ActionInput,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(
    actor.id,
    `payment.late-receipt:${id}`,
    key,
    input,
    async (tx) => {
      invariant(
        new Date(input.transferTime).getTime() <= Date.now() + 5 * 60_000,
        "VALIDATION_ERROR",
        "เวลาโอนเงินต้องไม่อยู่ในอนาคต",
        422,
      );
      const booking = await ownedBooking(tx, actor, id, true);
      invariant(
        ["EXPIRED", "CANCELLED", "REJECTED"].includes(booking.status) &&
          booking.version === input.version &&
          booking.verifiedAmountSatang === 0 &&
          !booking.verifiedPaymentId,
        "INVALID_TRANSITION",
        "บันทึกยอดรับย้อนหลังได้ครั้งเดียวสำหรับรายการที่สิ้นสุดแล้ว",
      );
      const asset = await tx.mediaAsset.findUnique({
        where: { id: input.assetId },
      });
      invariant(
        asset &&
          asset.bookingId === id &&
          asset.uploadStatus === "COMPLETE" &&
          asset.visibility === "PRIVATE",
        "VALIDATION_ERROR",
        "หลักฐานไม่อยู่ในรายการนี้",
        422,
      );
      const payment = await tx.paymentAttempt.create({
        data: {
          bookingId: id,
          assetId: asset.id,
          declaredAmountSatang: input.declaredAmountSatang,
          receivedAmountSatang: input.declaredAmountSatang,
          transferTime: new Date(input.transferTime),
          status: "VERIFIED",
          reviewerId: actor.id,
          reviewedAt: new Date(),
          reviewReason: input.reason,
        },
      });
      const changed = await tx.booking.updateMany({
        where: {
          id,
          version: input.version,
          status: booking.status,
          verifiedAmountSatang: 0,
        },
        data: {
          verifiedPaymentId: payment.id,
          verifiedAmountSatang: input.declaredAmountSatang,
          version: { increment: 1 },
        },
      });
      invariant(
        changed.count === 1,
        "CONFLICT",
        "รายการเปลี่ยนแปลง กรุณาโหลดใหม่",
      );
      await tx.refundRecord.create({
        data: {
          bookingId: id,
          paymentId: payment.id,
          amountSatang: input.declaredAmountSatang,
          reason: input.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "LATE_PAYMENT_RECORDED",
          entity: "Booking",
          entityId: id,
          reason: input.reason,
          changes: { receivedAmountSatang: input.declaredAmountSatang },
        },
      });
      return bookingResult(tx, id);
    },
  );
}
