import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { Actor } from "../src/server/auth";

test(
  "MongoDB replica-set transactional acceptance",
  { timeout: 240_000 },
  async (t) => {
    const replica = await MongoMemoryReplSet.create({
      binary: { version: "8.0.17" },
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    process.env.DATABASE_URL = replica.getUri("oneventone_acceptance");
    process.env.TICKET_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.STORAGE_DIRECTORY = path.resolve(
      ".local/test-evidence",
      randomUUID(),
    );
    // Keep the event loop free to drain mongod's log pipe while Prisma creates indexes.
    await promisify(execFile)(
      process.execPath,
      ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"],
      { env: process.env, encoding: "utf8", timeout: 60_000 },
    );
    const { prisma } = await import("../src/server/db");
    const { createBooking, getBooking, cancelBooking, expireUnpaidHolds } =
      await import("../src/server/services/booking");
    const {
      submitPayment,
      approveBooking,
      requestCorrection,
      recordLateReceipt,
      confirmDemoPayment,
    } = await import("../src/server/services/payment");
    const { getTickets } = await import("../src/server/services/ticket");
    const { checkIn } = await import("../src/server/services/checkin");
    const { uploadEvidence, privateAsset } =
      await import("../src/server/storage");
    const { completeRefund } = await import("../src/server/services/refund");
    const { createBookingSchema } = await import("../src/shared/booking");
    t.after(async () => {
      await prisma.$disconnect();
      await replica.stop();
    });
    await prisma.businessProfile.create({
      data: {
        displayName: "Acceptance fixture",
        theme: {},
        contact: {},
        paymentInstructions: {},
        bookingPolicy: { maxAdmissions: 100 },
      },
    });
    const customerUser = await prisma.user.create({
      data: {
        name: "Customer",
        email: `customer-${randomUUID()}@example.invalid`,
      },
    });
    const otherUser = await prisma.user.create({
      data: { name: "Other", email: `other-${randomUUID()}@example.invalid` },
    });
    const staffUser = await prisma.user.create({
      data: {
        name: "Reviewer",
        email: `staff-${randomUUID()}@example.invalid`,
        roles: ["CUSTOMER", "ADMIN"],
      },
    });
    const customer: Actor = {
      id: customerUser.id,
      roles: ["CUSTOMER"],
    };
    const other: Actor = {
      id: otherUser.id,
      roles: ["CUSTOMER"],
    };
    const staff: Actor = {
      id: staffUser.id,
      roles: ["CUSTOMER", "ADMIN"],
    };
    const key = () => randomUUID();
    const isError = (code: string) => (error: unknown) =>
      Boolean(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === code,
      );
    const pngBytes = await (
      await import("sharp")
    )
      .default({
        create: { width: 4, height: 4, channels: 3, background: "#e11d48" },
      })
      .png()
      .toBuffer();
    const image = () =>
      new File([pngBytes], "evidence.png", { type: "image/png" });

    async function fixture(capacity = 3) {
      const now = Date.now();
      const event = await prisma.event.create({
        data: {
          slug: `test-${key()}`,
          title: "Test live",
          description: "Test only",
          artists: [],
          venue: "Test venue",
          startsAt: new Date(now + 86_400_000),
          endsAt: new Date(now + 90_000_000),
          saleStartsAt: new Date(now - 1000),
          saleEndsAt: new Date(now + 80_000_000),
          status: "PUBLISHED",
        },
      });
      const template = await prisma.layoutTemplate.create({
        data: { eventId: event.id, name: "Test", geometry: [] },
      });
      const layout = await prisma.layoutVersion.create({
        data: {
          eventId: event.id,
          templateId: template.id,
          version: 1,
          width: 1000,
          height: 700,
          geometry: [],
        },
      });
      await prisma.event.update({
        where: { id: event.id },
        data: { publishedLayoutVersionId: layout.id },
      });
      const tableZone = await prisma.zone.create({
        data: {
          eventId: event.id,
          code: "TABLE",
          name: "Tables",
          sellingMode: "TABLE",
        },
      });
      const seatZone = await prisma.zone.create({
        data: {
          eventId: event.id,
          code: "SEAT",
          name: "Seats",
          sellingMode: "SEAT",
        },
      });
      const gaZone = await prisma.zone.create({
        data: {
          eventId: event.id,
          code: "GA",
          name: "GA",
          sellingMode: "GENERAL_ADMISSION",
          capacity,
        },
      });
      const table = await prisma.bookableUnit.create({
        data: {
          eventId: event.id,
          zoneId: tableZone.id,
          code: "T1",
          name: "Table 1",
          sellingMode: "TABLE",
          admissionCount: 4,
          priceSatang: 10000,
        },
      });
      const seat = await prisma.bookableUnit.create({
        data: {
          eventId: event.id,
          zoneId: seatZone.id,
          code: "S1",
          name: "Seat 1",
          sellingMode: "SEAT",
          admissionCount: 1,
          priceSatang: 2000,
        },
      });
      await prisma.unitInventory.createMany({
        data: [table, seat].map((unit) => ({
          eventId: event.id,
          unitId: unit.id,
        })),
      });
      const pool = await prisma.capacityPool.create({
        data: {
          eventId: event.id,
          zoneId: gaZone.id,
          code: "SHARED",
          capacity,
          available: capacity,
        },
      });
      const types = [];
      for (let i = 1; i <= 2; i++)
        types.push(
          await prisma.ticketType.create({
            data: {
              eventId: event.id,
              zoneId: gaZone.id,
              poolId: pool.id,
              code: `GA${i}`,
              name: `Price ${i}`,
              priceSatang: 1000 * i,
              saleStartsAt: event.saleStartsAt,
              saleEndsAt: event.saleEndsAt,
            },
          }),
        );
      return { event, table, seat, pool, types };
    }
    async function pendingReview(
      f: Awaited<ReturnType<typeof fixture>>,
      unit = f.table,
      actor = customer,
    ) {
      const booking = await createBooking(
        actor,
        { eventId: f.event.id, items: [{ unitId: unit.id, quantity: 1 }] },
        key(),
      );
      const asset = await uploadEvidence(actor, booking.id, image(), key());
      const pending = await submitPayment(
        actor,
        booking.id,
        {
          assetId: asset.id,
          declaredAmountSatang: booking.totalSatang,
          transferTime: new Date().toISOString(),
        },
        key(),
      );
      return { booking: pending, asset };
    }
    async function approve(
      booking: Awaited<ReturnType<typeof createBooking>>,
      commandKey = key(),
    ) {
      return approveBooking(
        staff,
        booking.id,
        {
          version: booking.version,
          paymentAttemptId: booking.payments[0].id,
          receivedAmountSatang: booking.totalSatang,
          reason: "Verified bank receipt",
        },
        commandKey,
      );
    }

    await t.test(
      "demo QR confirms once, issues tickets and does not record real revenue",
      async () => {
        const f = await fixture();
        const before = Date.now();
        const booking = await createBooking(
          customer,
          {
            eventId: f.event.id,
            items: [
              { unitId: f.table.id, quantity: 1 },
              { ticketTypeId: f.types[0].id, quantity: 2 },
            ],
          },
          key(),
        );
        const expiry = new Date(booking.holdExpiresAt).getTime();
        assert.ok(expiry >= before + 300_000 && expiry <= Date.now() + 300_000);
        await assert.rejects(
          confirmDemoPayment(other, booking.id, key()),
          isError("FORBIDDEN"),
        );
        const commandKey = key();
        const results = await Promise.all([
          confirmDemoPayment(customer, booking.id, commandKey),
          confirmDemoPayment(customer, booking.id, commandKey),
          confirmDemoPayment(customer, booking.id, key()),
        ]);
        assert.ok(results.every((result) => result.status === "CONFIRMED"));
        assert.equal(results[0].verifiedAmountSatang, 0);
        assert.equal(results[0].payments.length, 0);
        assert.equal(
          (await getTickets(customer, booking.id)).tickets.length,
          6,
        );
        assert.equal(
          (
            await prisma.capacityPool.findUniqueOrThrow({
              where: { id: f.pool.id },
            })
          ).sold,
          2,
        );
        assert.equal(
          (
            await prisma.unitInventory.findUniqueOrThrow({
              where: {
                eventId_unitId: { eventId: f.event.id, unitId: f.table.id },
              },
            })
          ).status,
          "SOLD",
        );
        assert.equal(
          await prisma.auditLog.count({
            where: { entityId: booking.id, action: "DEMO_PAYMENT_CONFIRMED" },
          }),
          1,
        );
      },
    );

    await t.test(
      "demo QR rejects expired, cancelled, legacy bookings and cancelled events",
      async () => {
        for (const scenario of [
          "expired",
          "cancelled",
          "legacy",
          "event",
        ] as const) {
          const f = await fixture();
          const booking = await createBooking(
            customer,
            {
              eventId: f.event.id,
              items: [{ unitId: f.table.id, quantity: 1 }],
            },
            key(),
          );
          if (scenario === "expired")
            await prisma.booking.update({
              where: { id: booking.id },
              data: { holdExpiresAt: new Date(Date.now() - 1) },
            });
          if (scenario === "cancelled")
            await cancelBooking(
              customer,
              booking.id,
              { version: booking.version, reason: "Cancel demo" },
              key(),
            );
          if (scenario === "legacy")
            await prisma.booking.update({
              where: { id: booking.id },
              data: { snapshot: {} },
            });
          if (scenario === "event")
            await prisma.event.update({
              where: { id: f.event.id },
              data: { status: "CANCELLED" },
            });
          await assert.rejects(
            confirmDemoPayment(customer, booking.id, key()),
            isError(
              scenario === "expired" ? "HOLD_EXPIRED" : "INVALID_TRANSITION",
            ),
          );
          assert.equal(
            await prisma.ticket.count({ where: { bookingId: booking.id } }),
            0,
          );
          if (scenario === "expired") {
            await expireUnpaidHolds(f.event.id);
            assert.equal(
              (await getBooking(customer, booking.id)).status,
              "EXPIRED",
            );
            assert.equal(
              (
                await prisma.unitInventory.findUniqueOrThrow({
                  where: {
                    eventId_unitId: { eventId: f.event.id, unitId: f.table.id },
                  },
                })
              ).status,
              "AVAILABLE",
            );
          }
        }
      },
    );

    await t.test(
      "20 simultaneous requests sell the last unit once",
      async () => {
        const f = await fixture();
        const results = await Promise.allSettled(
          Array.from({ length: 20 }, () =>
            createBooking(
              customer,
              {
                eventId: f.event.id,
                items: [{ unitId: f.table.id, quantity: 1 }],
              },
              key(),
            ),
          ),
        );
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(
          await prisma.booking.count({ where: { eventId: f.event.id } }),
          1,
        );
        const inventory = await prisma.unitInventory.findUniqueOrThrow({
          where: {
            eventId_unitId: { eventId: f.event.id, unitId: f.table.id },
          },
        });
        assert.equal(inventory.status, "HELD");
      },
    );
    await t.test(
      "multi-item failure rolls back every held unit and booking",
      async () => {
        const f = await fixture();
        await createBooking(
          customer,
          { eventId: f.event.id, items: [{ unitId: f.table.id, quantity: 1 }] },
          key(),
        );
        await assert.rejects(
          createBooking(
            other,
            {
              eventId: f.event.id,
              items: [
                { unitId: f.seat.id, quantity: 1 },
                { unitId: f.table.id, quantity: 1 },
              ],
            },
            key(),
          ),
          isError("INVENTORY_UNAVAILABLE"),
        );
        assert.equal(
          (
            await prisma.unitInventory.findUniqueOrThrow({
              where: {
                eventId_unitId: { eventId: f.event.id, unitId: f.seat.id },
              },
            })
          ).status,
          "AVAILABLE",
        );
        assert.equal(
          await prisma.booking.count({ where: { eventId: f.event.id } }),
          1,
        );
      },
    );
    await t.test(
      "multiple GA prices share capacity and concurrent requests cannot oversell",
      async () => {
        const f = await fixture(5);
        const results = await Promise.allSettled(
          Array.from({ length: 20 }, (_, i) =>
            createBooking(
              customer,
              {
                eventId: f.event.id,
                items: [{ ticketTypeId: f.types[i % 2].id, quantity: 1 }],
              },
              key(),
            ),
          ),
        );
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 5);
        const pool = await prisma.capacityPool.findUniqueOrThrow({
          where: { id: f.pool.id },
        });
        assert.equal(pool.available, 0);
        assert.equal(pool.held, 5);
        assert.equal(
          pool.available +
            pool.held +
            pool.reviewReserved +
            pool.sold +
            pool.blocked,
          pool.capacity,
        );
      },
    );
    await t.test(
      "durable create replay and payload conflict; client prices rejected",
      async () => {
        const f = await fixture();
        const requestKey = key();
        const input = {
          eventId: f.event.id,
          items: [{ unitId: f.table.id, quantity: 1 }],
        };
        const results = await Promise.all(
          Array.from({ length: 6 }, () =>
            createBooking(customer, input, requestKey),
          ),
        );
        assert.equal(new Set(results.map((b) => b.id)).size, 1);
        assert.equal(results[0].totalSatang, 10000);
        await assert.rejects(
          createBooking(
            customer,
            { ...input, items: [{ unitId: f.seat.id, quantity: 1 }] },
            requestKey,
          ),
          isError("IDEMPOTENCY_CONFLICT"),
        );
        assert.equal(
          createBookingSchema.safeParse({ ...input, totalSatang: 1 }).success,
          false,
        );
      },
    );
    await t.test(
      "expiry is idempotent and released unit can be booked again",
      async () => {
        const f = await fixture();
        const booking = await createBooking(
          customer,
          { eventId: f.event.id, items: [{ unitId: f.seat.id, quantity: 1 }] },
          key(),
        );
        await prisma.booking.update({
          where: { id: booking.id },
          data: { holdExpiresAt: new Date(Date.now() - 1000) },
        });
        await Promise.all([
          expireUnpaidHolds(f.event.id),
          expireUnpaidHolds(f.event.id),
        ]);
        assert.equal(
          (
            await prisma.booking.findUniqueOrThrow({
              where: { id: booking.id },
            })
          ).status,
          "EXPIRED",
        );
        const next = await createBooking(
          other,
          { eventId: f.event.id, items: [{ unitId: f.seat.id, quantity: 1 }] },
          key(),
        );
        await expireUnpaidHolds(f.event.id);
        assert.equal(
          (
            await prisma.unitInventory.findUniqueOrThrow({
              where: {
                eventId_unitId: { eventId: f.event.id, unitId: f.seat.id },
              },
            })
          ).holdBookingId,
          next.id,
        );
      },
    );
    await t.test(
      "submitted proof creates no QR; review/correction survive original expiry",
      async () => {
        const f = await fixture();
        const { booking } = await pendingReview(f);
        assert.deepEqual((await getTickets(customer, booking.id)).tickets, []);
        await prisma.booking.update({
          where: { id: booking.id },
          data: { holdExpiresAt: new Date(Date.now() - 1000) },
        });
        await expireUnpaidHolds(f.event.id);
        let current = await getBooking(customer, booking.id);
        assert.equal(current.status, "PENDING_REVIEW");
        current = await requestCorrection(
          staff,
          booking.id,
          { version: current.version, reason: "Please upload readable proof" },
          key(),
        );
        const asset = await uploadEvidence(
          customer,
          booking.id,
          image(),
          key(),
        );
        current = await submitPayment(
          customer,
          booking.id,
          {
            assetId: asset.id,
            declaredAmountSatang: current.totalSatang,
            transferTime: new Date().toISOString(),
          },
          key(),
        );
        assert.equal(current.payments.length, 2);
        assert.equal(current.status, "PENDING_REVIEW");
        assert.equal(current.payments[0].duplicateEvidenceWarning, true);
        assert.equal(
          (
            await prisma.unitInventory.findUniqueOrThrow({
              where: {
                eventId_unitId: { eventId: f.event.id, unitId: f.table.id },
              },
            })
          ).status,
          "REVIEW_RESERVED",
        );
      },
    );
    await t.test(
      "submit racing expiry at deadline cannot revive an expired hold",
      async () => {
        const f = await fixture();
        const booking = await createBooking(
          customer,
          { eventId: f.event.id, items: [{ unitId: f.seat.id, quantity: 1 }] },
          key(),
        );
        const asset = await uploadEvidence(
          customer,
          booking.id,
          image(),
          key(),
        );
        await prisma.booking.update({
          where: { id: booking.id },
          data: { holdExpiresAt: new Date(Date.now() - 1) },
        });
        const results = await Promise.allSettled([
          submitPayment(
            customer,
            booking.id,
            {
              assetId: asset.id,
              declaredAmountSatang: booking.totalSatang,
              transferTime: new Date().toISOString(),
            },
            key(),
          ),
          expireUnpaidHolds(f.event.id),
        ]);
        assert.equal(results[0].status, "rejected");
        assert.equal(
          (await getBooking(customer, booking.id)).status,
          "EXPIRED",
        );
        assert.equal(
          await prisma.paymentAttempt.count({
            where: { bookingId: booking.id },
          }),
          0,
        );
      },
    );
    await t.test(
      "owner and role checks protect booking, evidence, approval and check-in",
      async () => {
        const f = await fixture();
        const { booking, asset } = await pendingReview(f);
        await assert.rejects(
          getBooking(other, booking.id),
          isError("FORBIDDEN"),
        );
        await assert.rejects(
          privateAsset(other, asset.id),
          isError("FORBIDDEN"),
        );
        await assert.rejects(
          approveBooking(
            customer,
            booking.id,
            {
              version: booking.version,
              paymentAttemptId: booking.payments[0].id,
              receivedAmountSatang: booking.totalSatang,
              reason: "Not allowed",
            },
            key(),
          ),
          isError("FORBIDDEN"),
        );
        const response = await privateAsset(customer, asset.id);
        assert.match(response.headers.get("cache-control")!, /no-store/);
        // Customers can never check tickets in, not even their own.
        await assert.rejects(
          checkIn(
            customer,
            {
              eventId: f.event.id,
              token: randomBytes(32).toString("base64url"),
            },
            key(),
          ),
          isError("FORBIDDEN"),
        );
      },
    );
    await t.test(
      "approval creates four table tickets once; concurrent check-in admits once",
      async () => {
        const f = await fixture();
        const { booking } = await pendingReview(f);
        const approvalKey = key();
        await approve(booking, approvalKey);
        await approve(booking, approvalKey);
        const tickets = (await getTickets(customer, booking.id)).tickets;
        assert.equal(tickets.length, 4);
        assert.equal(
          (await getTickets(customer, booking.id)).tickets[0].token,
          tickets[0].token,
        );
        assert.equal(
          await prisma.paymentAttempt.count({
            where: { bookingId: booking.id, status: "VERIFIED" },
          }),
          1,
        );
        const gate = staff;
        const results = await Promise.allSettled(
          Array.from({ length: 8 }, () =>
            checkIn(
              gate,
              { eventId: f.event.id, token: tickets[0].token! },
              key(),
            ),
          ),
        );
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(
          await prisma.checkInLog.count({
            where: { ticketId: tickets[0].id, result: "ACCEPTED" },
          }),
          1,
        );
        const retryKey = key();
        const input = { eventId: f.event.id, token: tickets[1].token! };
        const first = await checkIn(gate, input, retryKey);
        assert.deepEqual(await checkIn(gate, input, retryKey), first);
      },
    );
    await t.test(
      "approve racing reject commits only one final transition",
      async () => {
        const f = await fixture();
        const { booking } = await pendingReview(f);
        const results = await Promise.allSettled([
          approve(booking),
          cancelBooking(
            staff,
            booking.id,
            { version: booking.version, reason: "Reject competing review" },
            key(),
            { reject: true },
          ),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const current = await getBooking(customer, booking.id);
        assert.ok(["CONFIRMED", "REJECTED"].includes(current.status));
        assert.equal(
          await prisma.ticket.count({ where: { bookingId: booking.id } }),
          current.status === "CONFIRMED" ? 4 : 0,
        );
      },
    );
    await t.test(
      "cancel separates pending refund; external refund proof records money once",
      async () => {
        const f = await fixture();
        const { booking } = await pendingReview(f);
        const confirmed = await approve(booking);
        const requestKey = key();
        const cancelled = await cancelBooking(
          staff,
          booking.id,
          { version: confirmed.version, reason: "Customer refund requested" },
          requestKey,
        );
        assert.equal(cancelled.refunds[0].status, "PENDING");
        await cancelBooking(
          staff,
          booking.id,
          { version: confirmed.version, reason: "Customer refund requested" },
          requestKey,
        );
        assert.equal(
          await prisma.refundRecord.count({ where: { bookingId: booking.id } }),
          1,
        );
        const proof = await uploadEvidence(staff, booking.id, image(), key());
        const refundKey = key();
        const input = {
          proofAssetId: proof.id,
          reason: "Transferred outside website",
        };
        await completeRefund(
          staff,
          booking.id,
          cancelled.refunds[0].id,
          input,
          refundKey,
        );
        await completeRefund(
          staff,
          booking.id,
          cancelled.refunds[0].id,
          input,
          refundKey,
        );
        assert.equal(
          (await getBooking(customer, booking.id)).refunds[0].amountSatang,
          confirmed.totalSatang,
        );
        assert.equal(
          await prisma.ticket.count({
            where: { bookingId: booking.id, status: "REVOKED" },
          }),
          4,
        );
        assert.equal(
          (
            await prisma.unitInventory.findUniqueOrThrow({
              where: {
                eventId_unitId: { eventId: f.event.id, unitId: f.table.id },
              },
            })
          ).status,
          "AVAILABLE",
        );
      },
    );
    await t.test(
      "late real receipt creates refund tracking without reviving booking or stock",
      async () => {
        const f = await fixture();
        const booking = await createBooking(
          customer,
          { eventId: f.event.id, items: [{ unitId: f.seat.id, quantity: 1 }] },
          key(),
        );
        await prisma.booking.update({
          where: { id: booking.id },
          data: { holdExpiresAt: new Date(Date.now() - 1000) },
        });
        await expireUnpaidHolds(f.event.id);
        const expired = await getBooking(customer, booking.id);
        const otherBooking = await createBooking(
          other,
          { eventId: f.event.id, items: [{ unitId: f.seat.id, quantity: 1 }] },
          key(),
        );
        const proof = await uploadEvidence(staff, booking.id, image(), key());
        await assert.rejects(
          recordLateReceipt(
            staff,
            booking.id,
            {
              version: expired.version,
              reason: "Future timestamp must fail",
              assetId: proof.id,
              declaredAmountSatang: booking.totalSatang,
              transferTime: new Date(Date.now() + 86_400_000).toISOString(),
            },
            key(),
          ),
          isError("VALIDATION_ERROR"),
        );
        const recorded = await recordLateReceipt(
          staff,
          booking.id,
          {
            version: expired.version,
            reason: "Verified transfer after expiry",
            assetId: proof.id,
            declaredAmountSatang: booking.totalSatang,
            transferTime: new Date().toISOString(),
          },
          key(),
        );
        assert.equal(recorded.status, "EXPIRED");
        assert.equal(recorded.refunds[0].status, "PENDING");
        assert.equal(
          (
            await prisma.unitInventory.findUniqueOrThrow({
              where: {
                eventId_unitId: { eventId: f.event.id, unitId: f.seat.id },
              },
            })
          ).holdBookingId,
          otherBooking.id,
        );
        assert.equal(
          await prisma.ticket.count({ where: { bookingId: booking.id } }),
          0,
        );
      },
    );
    await t.test(
      "GA and seat full lifecycle preserves shared pool counters and ticket counts",
      async () => {
        const f = await fixture(3);
        let booking = await createBooking(
          customer,
          {
            eventId: f.event.id,
            items: [
              { ticketTypeId: f.types[0].id, quantity: 2 },
              { ticketTypeId: f.types[1].id, quantity: 1 },
              { unitId: f.seat.id, quantity: 1 },
            ],
          },
          key(),
        );
        assert.equal(booking.totalAdmissions, 4);
        assert.equal(booking.totalSatang, 6000);
        const asset = await uploadEvidence(
          customer,
          booking.id,
          image(),
          key(),
        );
        const submitKey = key();
        const paymentInput = {
          assetId: asset.id,
          declaredAmountSatang: booking.totalSatang,
          transferTime: new Date().toISOString(),
        };
        booking = await submitPayment(
          customer,
          booking.id,
          paymentInput,
          submitKey,
        );
        await submitPayment(customer, booking.id, paymentInput, submitKey);
        assert.equal(
          await prisma.paymentAttempt.count({
            where: { bookingId: booking.id },
          }),
          1,
        );
        let pool = await prisma.capacityPool.findUniqueOrThrow({
          where: { id: f.pool.id },
        });
        assert.equal(pool.reviewReserved, 3);
        assert.equal(pool.held, 0);
        booking = await approve(booking);
        const tickets = (await getTickets(customer, booking.id)).tickets;
        assert.equal(tickets.length, 4);
        pool = await prisma.capacityPool.findUniqueOrThrow({
          where: { id: f.pool.id },
        });
        assert.equal(pool.sold, 3);
        assert.equal(pool.reviewReserved, 0);
        await cancelBooking(
          staff,
          booking.id,
          { version: booking.version, reason: "Cancel whole mixed booking" },
          key(),
        );
        pool = await prisma.capacityPool.findUniqueOrThrow({
          where: { id: f.pool.id },
        });
        assert.equal(pool.available, 3);
        assert.equal(pool.sold, 0);
        assert.equal(
          await prisma.capacityAllocation.count({
            where: { poolId: f.pool.id, status: "RELEASED" },
          }),
          2,
        );
        await assert.rejects(
          checkIn(
            staff,
            { eventId: f.event.id, token: tickets[0].token! },
            key(),
          ),
          isError("TICKET_REVOKED"),
        );
      },
    );
    await t.test(
      "same uploaded asset reuse is flagged and revoked staff lose evidence access",
      async () => {
        const f = await fixture();
        const { booking, asset } = await pendingReview(f);
        const correction = await requestCorrection(
          staff,
          booking.id,
          { version: booking.version, reason: "Need clearer bank evidence" },
          key(),
        );
        const resubmitted = await submitPayment(
          customer,
          booking.id,
          {
            assetId: asset.id,
            declaredAmountSatang: correction.totalSatang,
            transferTime: new Date().toISOString(),
          },
          key(),
        );
        assert.equal(resubmitted.payments[0].duplicateEvidenceWarning, true);
        const staffProof = await uploadEvidence(
          staff,
          booking.id,
          image(),
          key(),
        );
        await assert.rejects(
          privateAsset({ ...staff, roles: ["CUSTOMER"] }, staffProof.id),
          isError("FORBIDDEN"),
        );
        assert.equal((await privateAsset(customer, staffProof.id)).status, 200);
        await assert.rejects(
          uploadEvidence(
            customer,
            booking.id,
            new File(["invalid image"], "fake.png", { type: "image/png" }),
            key(),
          ),
        );
      },
    );
  },
);
