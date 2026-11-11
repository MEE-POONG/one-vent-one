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
  ticketTypeInput,
  layoutInput,
  type LayoutGeometry,
} from "../src/shared/catalog";

test(
  "MongoDB event structure: duplicate guards, edit/delete, duplicate event, draft return and event delete",
  { timeout: 180000 },
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
    process.env.DATABASE_URL = replica.getUri(
      "oneventone_structure_acceptance",
    );
    await promisify(execFile)(
      process.execPath,
      ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"],
      { env: process.env, encoding: "utf8", timeout: 60000 },
    );
    const { prisma } = await import("../src/server/db");
    cleanup.disconnect = () => prisma.$disconnect();
    const admin = await import("../src/server/services/event-admin");
    const structure = await import("../src/server/services/event-structure");
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
        name: "Structure test admin",
        email: `structure-admin-${run}@example.invalid`,
        roles: ["SUPER_ADMIN"],
      },
    });
    const customerUser = await prisma.user.create({
      data: {
        name: "Structure test customer",
        email: `structure-customer-${run}@example.invalid`,
      },
    });
    const staff: Actor = {
      id: adminUser.id,
      roles: adminUser.roles,
      assignedEventIds: [],
    };
    const customer: Actor = {
      id: customerUser.id,
      roles: customerUser.roles,
      assignedEventIds: [],
    };
    const version = async (id: string) =>
      (await prisma.event.findUniqueOrThrow({ where: { id } })).version;
    const now = Date.now();
    const input = createEventInput.parse({
      slug: `structure-${run}`,
      title: "Structure integration test",
      description: "Isolated generated fixture",
      venue: "Test venue",
      artists: [],
      startsAt: new Date(now + 86400000).toISOString(),
      endsAt: new Date(now + 90000000).toISOString(),
      saleStartsAt: new Date(now - 3600000).toISOString(),
      saleEndsAt: new Date(now + 7200000).toISOString(),
    });

    // Duplicate slug and codes report the real cause instead of a retry conflict.
    const event = await admin.createEvent(staff, input, randomUUID());
    await assert.rejects(admin.createEvent(staff, input, randomUUID()), {
      code: "SLUG_TAKEN",
    });
    const tables = await admin.createZone(
      staff,
      event.id,
      zoneInput.parse({ code: "TABLE", name: "Tables", sellingMode: "TABLE" }),
      randomUUID(),
    );
    await assert.rejects(
      admin.createZone(
        staff,
        event.id,
        zoneInput.parse({ code: "TABLE", name: "Again", sellingMode: "TABLE" }),
        randomUUID(),
      ),
      { code: "CODE_TAKEN" },
    );
    const ga = await admin.createZone(
      staff,
      event.id,
      zoneInput.parse({
        code: "GA",
        name: "Standing",
        sellingMode: "GENERAL_ADMISSION",
        capacity: 50,
      }),
      randomUUID(),
    );
    const t1 = await admin.createUnit(
      staff,
      event.id,
      unitInput.parse({
        zoneId: tables.id,
        code: "T01",
        name: "Table 1",
        sellingMode: "TABLE",
        admissionCount: 4,
        priceSatang: 100000,
      }),
      randomUUID(),
    );
    const t2 = await admin.createUnit(
      staff,
      event.id,
      unitInput.parse({
        zoneId: tables.id,
        code: "T02",
        name: "Table 2",
        sellingMode: "TABLE",
        admissionCount: 4,
        priceSatang: 100000,
      }),
      randomUUID(),
    );
    const early = await admin.createTicketType(
      staff,
      event.id,
      ticketTypeInput.parse({
        zoneId: ga.id,
        poolId: ga.pools[0].id,
        code: "EARLY",
        name: "Early Bird",
        priceSatang: 50000,
        saleStartsAt: input.saleStartsAt,
        saleEndsAt: input.saleEndsAt,
      }),
      randomUUID(),
    );
    const object = (unitId: string, code: string, x: number) => ({
      id: `object-${unitId}`,
      code,
      name: code,
      type: "table" as const,
      shape: "rect" as const,
      x,
      y: 50,
      width: 60,
      height: 60,
      rotation: 0,
      zoneId: tables.id,
      unitId,
    });
    const draft = await getDraftLayout(event.id);
    await saveLayout(
      staff,
      event.id,
      layoutInput.parse({
        version: draft.version,
        width: 600,
        height: 400,
        geometry: {
          objects: [object(t1.id, "T01", 50), object(t2.id, "T02", 180)],
        },
      }),
      randomUUID(),
    );

    // Zone edit; zone delete refuses while units remain.
    const renamed = await structure.updateZone(
      staff,
      event.id,
      tables.id,
      {
        name: "VIP tables",
        color: "#112233",
        eventVersion: await version(event.id),
      },
      randomUUID(),
    );
    assert.equal(renamed.name, "VIP tables");
    await assert.rejects(
      structure.deleteZone(
        staff,
        event.id,
        tables.id,
        { eventVersion: await version(event.id) },
        randomUUID(),
      ),
      { code: "INVALID_TRANSITION" },
    );
    // A stale version is rejected.
    await assert.rejects(
      structure.deleteUnit(
        staff,
        event.id,
        t2.id,
        { eventVersion: 0 },
        randomUUID(),
      ),
      { code: "VERSION_CONFLICT" },
    );
    // Unit delete also removes its object from the draft layout.
    const removedUnit = await structure.deleteUnit(
      staff,
      event.id,
      t2.id,
      { eventVersion: await version(event.id) },
      randomUUID(),
    );
    assert.equal(removedUnit.layoutObjectsRemoved, 1);
    const pruned = await getDraftLayout(event.id);
    assert.deepEqual(
      (pruned.geometry as unknown as LayoutGeometry).objects.map((o) => o.code),
      ["T01"],
    );
    assert.equal(
      await prisma.unitInventory.count({ where: { unitId: t2.id } }),
      0,
    );

    // Ticket type edit: deactivate, then delete while still a draft.
    const paused = await structure.updateTicketType(
      staff,
      event.id,
      early.id,
      {
        saleStartsAt: input.saleStartsAt,
        saleEndsAt: input.saleEndsAt,
        active: false,
        eventVersion: await version(event.id),
        reason: "Pause early bird",
      },
      randomUUID(),
    );
    assert.equal(paused.active, false);
    await structure.deleteTicketType(
      staff,
      event.id,
      early.id,
      { eventVersion: await version(event.id) },
      randomUUID(),
    );
    const gaDelete = await structure.deleteZone(
      staff,
      event.id,
      ga.id,
      { eventVersion: await version(event.id) },
      randomUUID(),
    );
    assert.equal(gaDelete.deleted, true);
    assert.equal(
      await prisma.capacityPool.count({ where: { eventId: event.id } }),
      0,
    );

    // Publish, book, then verify history protects deletes and draft return.
    const layout = await getDraftLayout(event.id);
    const published = await publishLayout(
      staff,
      event.id,
      { version: layout.version },
      randomUUID(),
    );
    assert.ok(published.id);
    await admin.changeEventStatus(
      staff,
      event.id,
      "PUBLISHED",
      { version: await version(event.id), reason: "Open sales" },
      randomUUID(),
    );
    const booking = await createBooking(
      customer,
      { eventId: event.id, items: [{ unitId: t1.id, quantity: 1 }] },
      randomUUID(),
    );
    await admin.changeEventStatus(
      staff,
      event.id,
      "CLOSED",
      { version: await version(event.id), reason: "Close sales" },
      randomUUID(),
    );
    await assert.rejects(
      admin.changeEventStatus(
        staff,
        event.id,
        "DRAFT",
        { version: await version(event.id), reason: "Active booking blocks" },
        randomUUID(),
      ),
      { code: "INVALID_TRANSITION" },
    );
    const held = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    await cancelBooking(
      customer,
      booking.id,
      { version: held.version, reason: "Test cleanup" },
      randomUUID(),
    );
    const back = await admin.changeEventStatus(
      staff,
      event.id,
      "DRAFT",
      { version: await version(event.id), reason: "Restructure" },
      randomUUID(),
    );
    assert.equal(back.status, "DRAFT");
    // The booked unit keeps its history and cannot be deleted.
    await assert.rejects(
      structure.deleteUnit(
        staff,
        event.id,
        t1.id,
        { eventVersion: await version(event.id) },
        randomUUID(),
      ),
      { code: "INVALID_TRANSITION" },
    );
    await assert.rejects(
      structure.deleteEvent(
        staff,
        event.id,
        { version: await version(event.id), reason: "Has history" },
        randomUUID(),
      ),
      { code: "INVALID_TRANSITION" },
    );

    // Duplicate copies structure and layout with new ids, as a fresh draft.
    const shiftMs = 7 * 86400000;
    const copyInput = createEventInput.parse({
      ...input,
      slug: `structure-copy-${run}`,
      title: "Structure copy",
      startsAt: new Date(Date.parse(input.startsAt) + shiftMs).toISOString(),
      endsAt: new Date(Date.parse(input.endsAt) + shiftMs).toISOString(),
      saleEndsAt: new Date(
        Date.parse(input.saleEndsAt) + shiftMs,
      ).toISOString(),
    });
    await assert.rejects(
      structure.duplicateEvent(
        staff,
        event.id,
        { ...copyInput, slug: input.slug },
        randomUUID(),
      ),
      { code: "SLUG_TAKEN" },
    );
    const copy = await structure.duplicateEvent(
      staff,
      event.id,
      copyInput,
      randomUUID(),
    );
    assert.equal(copy.status, "DRAFT");
    const copied = await admin.adminEvent(copy.id);
    assert.equal(copied.bookingCount, 0);
    assert.deepEqual(
      copied.zones.map((z) => z.code),
      ["TABLE"],
    );
    assert.equal(copied.zones[0].name, "VIP tables");
    assert.deepEqual(
      copied.units.map((u) => u.code),
      ["T01"],
    );
    assert.notEqual(copied.units[0].id, t1.id);
    assert.equal(copied.units[0].inventory[0].status, "AVAILABLE");
    const copiedObjects = (
      copied.layoutTemplate?.geometry as unknown as LayoutGeometry
    ).objects;
    assert.equal(copiedObjects.length, 1);
    assert.equal(copiedObjects[0].unitId, copied.units[0].id);
    assert.equal(copiedObjects[0].zoneId, copied.zones[0].id);
    // The copied draft layout is valid for its own event and can be published.
    const copyDraft = await getDraftLayout(copy.id);
    await publishLayout(
      staff,
      copy.id,
      { version: copyDraft.version },
      randomUUID(),
    );

    // A booking-free event can be deleted with all of its structure.
    const removed = await structure.deleteEvent(
      staff,
      copy.id,
      { version: await version(copy.id), reason: "Remove test copy" },
      randomUUID(),
    );
    assert.equal(removed.deleted, true);
    assert.equal(await prisma.event.count({ where: { id: copy.id } }), 0);
    for (const count of await Promise.all([
      prisma.zone.count({ where: { eventId: copy.id } }),
      prisma.bookableUnit.count({ where: { eventId: copy.id } }),
      prisma.unitInventory.count({ where: { eventId: copy.id } }),
      prisma.layoutTemplate.count({ where: { eventId: copy.id } }),
      prisma.layoutVersion.count({ where: { eventId: copy.id } }),
    ]))
      assert.equal(count, 0);
    // Customers cannot use any of these operations.
    await assert.rejects(
      structure.deleteEvent(
        customer,
        event.id,
        { version: await version(event.id), reason: "Not allowed" },
        randomUUID(),
      ),
      { code: "FORBIDDEN" },
    );
  },
);
