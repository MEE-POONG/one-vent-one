/**
 * One-time migration to the three-role model (CUSTOMER / ADMIN / SUPER_ADMIN).
 * Accounts holding a removed staff role (EVENT_MANAGER, PAYMENT_REVIEWER,
 * CHECKIN_STAFF) become ADMIN; SUPER_ADMIN stays SUPER_ADMIN. Safe to rerun.
 *
 *   npm run db:migrate-roles
 *
 * Uses raw commands because the generated client cannot read a document whose
 * enum value no longer exists in the schema.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const LEGACY = ["EVENT_MANAGER", "PAYMENT_REVIEWER", "CHECKIN_STAFF"];
const prisma = new PrismaClient();

type RawUser = { _id: { $oid: string }; email: string; roles: string[] };

async function main() {
  const found = (await prisma.$runCommandRaw({
    find: "User",
    filter: { roles: { $in: LEGACY } },
    projection: { email: 1, roles: 1 },
    batchSize: 100000,
  })) as unknown as { cursor: { firstBatch: RawUser[] } };
  const users = found.cursor.firstBatch;
  if (!users.length) {
    console.log("ไม่มีบัญชีที่ใช้ role เดิม ไม่ต้องย้ายข้อมูล");
    return;
  }
  for (const user of users) {
    const level = user.roles.includes("SUPER_ADMIN") ? "SUPER_ADMIN" : "ADMIN";
    const roles = ["CUSTOMER", level];
    await prisma.$runCommandRaw({
      update: "User",
      updates: [
        {
          // Matching the old value too keeps a concurrent edit from being overwritten.
          q: { _id: { $oid: user._id.$oid }, roles: { $in: LEGACY } },
          u: { $set: { roles } },
        },
      ],
    });
    await prisma.auditLog.create({
      data: {
        action: "ROLE_MIGRATION",
        entity: "User",
        entityId: user._id.$oid,
        reason: "Migrated to CUSTOMER/ADMIN/SUPER_ADMIN roles",
        changes: { before: user.roles, after: roles },
      },
    });
    console.log(
      `${user.email}: ${user.roles.join(", ")} → ${roles.join(", ")}`,
    );
  }
  console.log(`ย้ายข้อมูลแล้ว ${users.length} บัญชี`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
