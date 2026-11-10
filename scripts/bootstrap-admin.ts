import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

const prisma = new PrismaClient();
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
if (!email || !password || password.length < 12)
  throw new Error(
    "Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters.",
  );
const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "mongodb" }),
  advanced: { database: { generateId: false } },
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
});
async function main() {
  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      if (!exists.roles.includes("SUPER_ADMIN"))
        throw new Error(
          "Account already exists. Refusing to promote an existing public account through bootstrap.",
        );
      console.log("Administrator already exists; no password or role changed.");
    } else {
      const result = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name: process.env.BOOTSTRAP_ADMIN_NAME ?? "ผู้ดูแล OneVentOne",
        },
      });
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: result.user.id },
          data: { roles: ["CUSTOMER", "SUPER_ADMIN"] },
        });
        await tx.auditLog.create({
          data: {
            actorId: result.user.id,
            action: "BOOTSTRAP_ADMIN",
            entity: "User",
            entityId: result.user.id,
            reason: "Explicit local administrator bootstrap",
          },
        });
      });
      console.log(
        "Administrator created. Remove BOOTSTRAP_ADMIN_PASSWORD from the environment.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
