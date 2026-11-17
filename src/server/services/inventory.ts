import "server-only";
import type {
  AllocationStatus,
  Booking,
  BookingItem,
  UnitInventoryStatus,
} from "@prisma/client";
import { invariant } from "@/server/errors";
import type { Tx } from "./transaction";

const counter = {
  HELD: "held",
  REVIEW_RESERVED: "reviewReserved",
  SOLD: "sold",
} as const;
type Reserved = keyof typeof counter;

export async function moveInventory(
  tx: Tx,
  booking: Booking & { items: BookingItem[] },
  from: Reserved,
  to: Reserved | "RELEASED",
) {
  for (const item of booking.items) {
    if (item.unitId) {
      const changed = await tx.unitInventory.updateMany({
        where: {
          eventId: booking.eventId,
          unitId: item.unitId,
          holdBookingId: booking.id,
          status: from as UnitInventoryStatus,
        },
        data: {
          status: to === "RELEASED" ? "AVAILABLE" : to,
          version: { increment: 1 },
          ...(to === "RELEASED"
            ? { holdBookingId: null, holdExpiresAt: null }
            : to === "REVIEW_RESERVED"
              ? { holdExpiresAt: null }
              : {}),
        },
      });
      invariant(
        changed.count === 1,
        "INVENTORY_UNAVAILABLE",
        "สิทธิ์ของรายการนี้เปลี่ยนแปลง กรุณาให้เจ้าหน้าที่ตรวจสอบ",
      );
    } else {
      const allocation = await tx.capacityAllocation.findUnique({
        where: { bookingItemId: item.id },
      });
      invariant(
        allocation &&
          allocation.status === from &&
          allocation.quantity === item.quantity &&
          allocation.poolId === item.poolId,
        "INVENTORY_UNAVAILABLE",
        "โควตาการจองไม่ตรงกับรายการ",
      );
      const changed = await tx.capacityAllocation.updateMany({
        where: { id: allocation.id, version: allocation.version, status: from },
        data: { status: to as AllocationStatus, version: { increment: 1 } },
      });
      invariant(
        changed.count === 1,
        "INVENTORY_UNAVAILABLE",
        "โควตาการจองเปลี่ยนแปลง",
      );
      const source = counter[from];
      const target = to === "RELEASED" ? "available" : counter[to];
      const moved = await tx.capacityPool.updateMany({
        where: {
          id: allocation.poolId,
          [source]: { gte: allocation.quantity },
        },
        data: {
          [source]: { decrement: allocation.quantity },
          [target]: { increment: allocation.quantity },
          version: { increment: 1 },
        },
      });
      invariant(
        moved.count === 1,
        "INVENTORY_UNAVAILABLE",
        "จำนวนสิทธิ์ไม่สอดคล้อง กรุณาให้เจ้าหน้าที่ตรวจสอบ",
      );
    }
  }
}
