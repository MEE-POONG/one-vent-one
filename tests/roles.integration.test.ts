import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { Actor } from "../src/server/auth";
import { createEventInput } from "../src/shared/catalog";

const exec = promisify(execFile);

test(
  "Three roles: legacy staff roles migrate to ADMIN; owner-only staff/settings; admin runs operations",
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
    process.env.DATABASE_URL = replica.getUri("oneventone_roles_acceptance");
    await exec(
      process.execPath,
      ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"],
      { env: process.env, encoding: "utf8", timeout: 60000 },
    );
    const { prisma } = await import("../src/server/db");
    cleanup.disconnect = () => prisma.$disconnect();

    // Accounts written by the previous five-role version.
    const now = { $date: new Date().toISOString() };
    const legacy = {
      manager: ["CUSTOMER", "EVENT_MANAGER"],
      reviewer: ["PAYMENT_REVIEWER", "CHECKIN_STAFF"],
      owner: ["CUSTOMER", "SUPER_ADMIN", "CHECKIN_STAFF"],
      customer: ["CUSTOMER"],
    };
    await prisma.$runCommandRaw({
      insert: "User",
      documents: Object.entries(legacy).map(([name, roles]) => ({
        name,
        email: `${name}@example.invalid`,
        emailVerified: false,
        roles,
        createdAt: now,
        updatedAt: now,
      })),
    });
    // Why the migration is needed: the typed client cannot read removed enum values.
    await assert.rejects(prisma.user.findMany());

    const migrate = () =>
      exec(
        process.execPath,
        ["node_modules/tsx/dist/cli.mjs", "scripts/migrate-roles.ts"],
        { env: process.env, encoding: "utf8", timeout: 60000 },
      );
    await migrate();
    const users = Object.fromEntries(
      (await prisma.user.findMany()).map((u) => [u.name, u]),
    );
    assert.deepEqual(users.manager.roles, ["CUSTOMER", "ADMIN"]);
    assert.deepEqual(users.reviewer.roles, ["CUSTOMER", "ADMIN"]);
    assert.deepEqual(users.owner.roles, ["CUSTOMER", "SUPER_ADMIN"]);
    assert.deepEqual(users.customer.roles, ["CUSTOMER"]);
    assert.equal(
      await prisma.auditLog.count({ where: { action: "ROLE_MIGRATION" } }),
      3,
    );
    // Rerunning is a no-op.
    const rerun = await migrate();
    assert.match(rerun.stdout, /ไม่ต้องย้ายข้อมูล/);
    assert.equal(
      await prisma.auditLog.count({ where: { action: "ROLE_MIGRATION" } }),
      3,
    );

    const actor = (name: keyof typeof legacy): Actor => ({
      id: users[name].id,
      roles: users[name].roles,
    });
    const owner = actor("owner");
    const admin = actor("manager");
    const customer = actor("customer");
    const { updateStaff, updateBusiness, accessLevel } =
      await import("../src/server/services/administration");
    const { createEvent } = await import("../src/server/services/event-admin");
    const { checkIn } = await import("../src/server/services/checkin");

    // Owner-only: staff and shop settings.
    await assert.rejects(
      updateStaff(
        admin,
        { userId: customer.id, role: "ADMIN", reason: "Admins cannot grant" },
        randomUUID(),
      ),
      { code: "FORBIDDEN" },
    );
    await assert.rejects(
      updateBusiness(
        admin,
        {
          displayName: "x",
          contact: {},
          paymentInstructions: {},
          bookingPolicy: {
            holdMinutes: 15,
            reviewHours: 24,
            correctionHours: 24,
            terms: "x",
          },
        },
        randomUUID(),
      ),
      { code: "FORBIDDEN" },
    );
    await assert.rejects(
      updateStaff(
        owner,
        { userId: owner.id, role: "ADMIN", reason: "Self demotion" },
        randomUUID(),
      ),
      { code: "FORBIDDEN" },
    );
    const promoted = await updateStaff(
      owner,
      { userId: customer.id, role: "ADMIN", reason: "New web staff" },
      randomUUID(),
    );
    assert.deepEqual(promoted.roles, ["CUSTOMER", "ADMIN"]);
    assert.equal(promoted.role, "ADMIN");
    const demoted = await updateStaff(
      owner,
      { userId: customer.id, role: "CUSTOMER", reason: "Left the shop" },
      randomUUID(),
    );
    assert.deepEqual(demoted.roles, ["CUSTOMER"]);
    assert.equal(accessLevel(["CUSTOMER", "SUPER_ADMIN"]), "SUPER_ADMIN");

    // Admins run operations, customers cannot.
    const now2 = Date.now();
    const input = createEventInput.parse({
      slug: `roles-${randomUUID()}`,
      title: "Roles integration test",
      description: "",
      venue: "Test venue",
      artists: [],
      startsAt: new Date(now2 + 86400000).toISOString(),
      endsAt: new Date(now2 + 90000000).toISOString(),
      saleStartsAt: new Date(now2 - 3600000).toISOString(),
      saleEndsAt: new Date(now2 + 7200000).toISOString(),
    });
    await assert.rejects(createEvent(customer, input, randomUUID()), {
      code: "FORBIDDEN",
    });
    const event = await createEvent(admin, input, randomUUID());
    assert.equal(event.status, "DRAFT");
    // Check-in needs no per-event assignment any more: the role check passes and
    // the unknown token is what fails.
    await assert.rejects(
      checkIn(
        admin,
        { eventId: event.id, token: "x".repeat(43) },
        randomUUID(),
      ),
      (error: { code?: string }) => error.code !== "FORBIDDEN",
    );
    await assert.rejects(
      checkIn(
        customer,
        { eventId: event.id, token: "x".repeat(43) },
        randomUUID(),
      ),
      { code: "FORBIDDEN" },
    );
  },
);
