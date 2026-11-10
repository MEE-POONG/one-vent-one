import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { Actor } from "../src/server/auth";
import {
  createEventInput,
  zoneInput,
  unitInput,
  layoutInput,
  type LayoutGeometry,
} from "../src/shared/catalog";

test(
  "MongoDB catalogue: role checks, draft conflicts, publish coverage, immutable layout and price snapshots",
  { timeout: 120000 },
  async (t) => {
    const replica = await MongoMemoryReplSet.create({
      binary: { version: "8.0.17" },
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const cleanup: { disconnect?: () => Promise<void> } = {};
    t.after(async () => {
      await cleanup.disconnect?.();
      await replica.stop();
    });
    process.env.DATABASE_URL = replica.getUri("oneventone_catalog_acceptance");
    await promisify(execFile)(
      process.execPath,
      ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"],
      { env: process.env, encoding: "utf8", timeout: 60000 },
    );
    const { prisma } = await import("../src/server/db");
    cleanup.disconnect = () => prisma.$disconnect();
    const {
      createEvent,
      createZone,
      createUnit,
      changeEventStatus,
      editPrice,
      listAdminEvents,
      setUnitActive,
    } = await import("../src/server/services/event-admin");
    const { getDraftLayout, saveLayout, publishLayout } =
      await import("../src/server/services/layout");
    const { createBooking, cancelBooking } =
      await import("../src/server/services/booking");
    await prisma.businessProfile.create({
      data: {
        key: "primary",
        displayName: "Isolated test business",
        theme: {},
        contact: {},
        paymentInstructions: {},
        bookingPolicy: { terms: "Test terms" },
      },
    });
    const run = randomUUID();
    const adminUser = await prisma.user.create({
      data: {
        name: "Catalogue test admin",
        email: `catalog-admin-${run}@example.invalid`,
        roles: ["SUPER_ADMIN"],
      },
    });
    const customerUser = await prisma.user.create({
      data: {
        name: "Catalogue test customer",
        email: `catalog-customer-${run}@example.invalid`,
      },
    });
    const admin: Actor = {
      id: adminUser.id,
      roles: adminUser.roles,
      assignedEventIds: [],
    };
    const customer: Actor = {
      id: customerUser.id,
      roles: customerUser.roles,
      assignedEventIds: [],
    };
    const now = Date.now();
    const input = createEventInput.parse({
      slug: `catalog-${run}`,
      title: "Catalogue integration test",
      description: "Isolated generated fixture",
      venue: "Test venue",
      artists: [],
      startsAt: new Date(now + 86400000).toISOString(),
      endsAt: new Date(now + 90000000).toISOString(),
      saleStartsAt: new Date(now - 3600000).toISOString(),
      saleEndsAt: new Date(now + 7200000).toISOString(),
    });
    try {
      await assert.rejects(createEvent(customer, input, randomUUID()), {
        code: "FORBIDDEN",
      });
      const event = await createEvent(admin, input, randomUUID());
      const assignedEvents = await listAdminEvents(1, 1, "", [event.id]);
      assert.equal(assignedEvents.total, 1);
      assert.equal(assignedEvents.items[0].id, event.id);
      const noAssignments = await listAdminEvents(1, 1, "", []);
      assert.equal(noAssignments.total, 0);
      assert.deepEqual(noAssignments.items, []);
      const zone = await createZone(
        admin,
        event.id,
        zoneInput.parse({
          code: "TABLE",
          name: "Tables",
          sellingMode: "TABLE",
        }),
        randomUUID(),
      );
      const unit1 = await createUnit(
        admin,
        event.id,
        unitInput.parse({
          zoneId: zone.id,
          code: "T01",
          name: "Table 1",
          sellingMode: "TABLE",
          admissionCount: 4,
          priceSatang: 100000,
        }),
        randomUUID(),
      );
      const object1: LayoutGeometry["objects"][number] = {
        id: `object-${unit1.id}`,
        code: "T01",
        name: "Table 1",
        type: "table",
        shape: "rect",
        x: 50,
        y: 50,
        width: 60,
        height: 60,
        rotation: 0,
        zoneId: zone.id,
        unitId: unit1.id,
      };
      const draft = await getDraftLayout(event.id);
      const saved = await saveLayout(
        admin,
        event.id,
        layoutInput.parse({
          version: draft.version,
          width: 600,
          height: 400,
          geometry: { objects: [object1] },
        }),
        randomUUID(),
      );
      await assert.rejects(
        saveLayout(
          admin,
          event.id,
          layoutInput.parse({
            version: draft.version,
            width: 600,
            height: 400,
            geometry: { objects: [object1] },
          }),
          randomUUID(),
        ),
        { code: "VERSION_CONFLICT" },
      );
      const first = await publishLayout(
        admin,
        event.id,
        { version: saved.version },
        randomUUID(),
      );
      const unit2 = await createUnit(
        admin,
        event.id,
        unitInput.parse({
          zoneId: zone.id,
          code: "T02",
          name: "Table 2",
          sellingMode: "TABLE",
          admissionCount: 4,
          priceSatang: 120000,
        }),
        randomUUID(),
      );
      const afterUnit = await prisma.event.findUniqueOrThrow({
        where: { id: event.id },
      });
      await assert.rejects(
        changeEventStatus(
          admin,
          event.id,
          "PUBLISHED",
          {
            version: afterUnit.version,
            reason: "Missing active unit in published layout",
          },
          randomUUID(),
        ),
        { code: "VALIDATION_ERROR" },
      );
      const object2 = {
        ...object1,
        id: `object-${unit2.id}`,
        code: "T02",
        name: "Table 2",
        unitId: unit2.id,
        x: 180,
      };
      const secondDraft = await saveLayout(
        admin,
        event.id,
        layoutInput.parse({
          version: first.draftVersion,
          width: 600,
          height: 400,
          geometry: { objects: [object1, object2] },
        }),
        randomUUID(),
      );
      const second = await publishLayout(
        admin,
        event.id,
        { version: secondDraft.version },
        randomUUID(),
      );
      const ready = await prisma.event.findUniqueOrThrow({
        where: { id: event.id },
      });
      await changeEventStatus(
        admin,
        event.id,
        "PUBLISHED",
        { version: ready.version, reason: "Complete layout validated" },
        randomUUID(),
      );
      const booking = await createBooking(
        customer,
        { eventId: event.id, items: [{ unitId: unit1.id, quantity: 1 }] },
        randomUUID(),
      );
      assert.equal(booking.totalAdmissions, 4);
      assert.equal(booking.totalSatang, 100000);
      assert.equal(booking.layoutVersionId, second.id);
      const afterBooking = await prisma.event.findUniqueOrThrow({
        where: { id: event.id },
      });
      await editPrice(
        admin,
        event.id,
        unit1.id,
        "unit",
        {
          eventVersion: afterBooking.version,
          name: "Updated table",
          priceSatang: 150000,
          reason: "New price applies only to future bookings",
        },
        randomUUID(),
      );
      const changedDraft = await saveLayout(
        admin,
        event.id,
        layoutInput.parse({
          version: second.draftVersion,
          width: 600,
          height: 400,
          geometry: { objects: [{ ...object1, x: 80 }, object2] },
        }),
        randomUUID(),
      );
      const third = await publishLayout(
        admin,
        event.id,
        { version: changedDraft.version },
        randomUUID(),
      );
      assert.notEqual(third.id, second.id);
      const preserved = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { items: true },
      });
      assert.equal(preserved.totalSatang, 100000);
      assert.equal(preserved.items[0].unitPriceSatang, 100000);
      assert.equal(preserved.layoutVersionId, second.id);
      const oldLayout = await prisma.layoutVersion.findUniqueOrThrow({
        where: { id: second.id },
      });
      assert.equal((oldLayout.geometry as LayoutGeometry).objects[0].x, 50);
      await assert.rejects(
        saveLayout(
          admin,
          event.id,
          layoutInput.parse({
            version: third.draftVersion,
            width: 600,
            height: 400,
            geometry: { objects: [object2] },
          }),
          randomUUID(),
        ),
        { code: "INVALID_TRANSITION" },
      );
      await cancelBooking(
        customer,
        booking.id,
        { version: preserved.version, reason: "Integration test completed" },
        randomUUID(),
      );
      const end = await prisma.event.findUniqueOrThrow({
        where: { id: event.id },
      });
      await changeEventStatus(
        admin,
        event.id,
        "CLOSED",
        { version: end.version, reason: "Integration test completed" },
        randomUUID(),
      );
      const splitEvent = await createEvent(
        admin,
        { ...input, slug: `subtable-${run}` },
        randomUUID(),
      );
      const parentZone = await createZone(
        admin,
        splitEvent.id,
        zoneInput.parse({
          code: "TABLE",
          name: "Parent tables",
          sellingMode: "TABLE",
        }),
        randomUUID(),
      );
      const childZone = await createZone(
        admin,
        splitEvent.id,
        zoneInput.parse({
          code: "SEAT",
          name: "Individual seats",
          sellingMode: "SEAT",
        }),
        randomUUID(),
      );
      const parent = await createUnit(
        admin,
        splitEvent.id,
        unitInput.parse({
          zoneId: parentZone.id,
          code: "P1",
          name: "Parent table",
          sellingMode: "TABLE",
          admissionCount: 4,
          priceSatang: 200000,
        }),
        randomUUID(),
      );
      const seatInput = unitInput.parse({
        zoneId: childZone.id,
        code: "P1-S1",
        name: "Child seat",
        sellingMode: "SEAT",
        admissionCount: 1,
        priceSatang: 50000,
        parentUnitId: parent.id,
      });
      await assert.rejects(
        createUnit(admin, splitEvent.id, seatInput, randomUUID()),
        { code: "VALIDATION_ERROR" },
      );
      const beforeSplit = await prisma.event.findUniqueOrThrow({
        where: { id: splitEvent.id },
      });
      const inactive = await setUnitActive(
        admin,
        splitEvent.id,
        parent.id,
        {
          eventVersion: beforeSplit.version,
          active: false,
          reason: "Switch to individual seats before sale",
        },
        randomUUID(),
      );
      assert.equal(inactive.active, false);
      const child = await createUnit(
        admin,
        splitEvent.id,
        seatInput,
        randomUUID(),
      );
      assert.equal(child.parentTableId, parent.id);
      assert.equal(child.active, true);
      const afterSplit = await prisma.event.findUniqueOrThrow({
        where: { id: splitEvent.id },
      });
      await assert.rejects(
        setUnitActive(
          admin,
          splitEvent.id,
          parent.id,
          {
            eventVersion: afterSplit.version,
            active: true,
            reason: "Must not sell a parent and child simultaneously",
          },
          randomUUID(),
        ),
        { code: "INVALID_TRANSITION" },
      );
    } finally {
      /* This test owns its ephemeral replica set; t.after removes it. */
    }
  },
);
