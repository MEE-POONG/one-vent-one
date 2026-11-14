import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { DomainError, invariant } from "@/server/errors";
import { api, readJson } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("request"),
      email: z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง").max(200),
    })
    .strict(),
  z
    .object({
      action: z.literal("reset"),
      email: z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง").max(200),
      code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "รหัสยืนยันต้องเป็นตัวเลข 6 หลัก"),
      newPassword: z
        .string()
        .min(8, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร")
        .max(128, "รหัสผ่านใหม่ต้องไม่เกิน 128 ตัวอักษร"),
    })
    .strict(),
]);

function hashResetCode(email: string, code: string) {
  return createHash("sha256")
    .update(`pwd-reset:${email.toLowerCase()}:${code}`)
    .digest("hex");
}

export const POST = api(async (request) => {
  const body = await readJson(request, requestSchema);
  const email = body.email.toLowerCase();
  await rateLimit(`pwd-recovery:${email}`, "password-recovery", 15);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: { where: { providerId: "credential" } } },
  });

  if (
    !user ||
    user.email.endsWith("@guest.oneventone.local") ||
    user.accounts.length === 0
  ) {
    throw new DomainError(
      "NOT_FOUND",
      "ไม่พบบัญชีสมาชิกที่ใช้อีเมลนี้ในระบบ กรุณาตรวจสอบอีเมลอีกครั้ง",
      404,
    );
  }

  const identifier = `pwd-reset:${email}`;

  if (body.action === "request") {
    const otp = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const hashed = hashResetCode(email, otp);

    await prisma.verification.deleteMany({ where: { identifier } });
    await prisma.verification.create({
      data: {
        identifier,
        value: hashed,
        expiresAt,
      },
    });

    console.info(
      `[Password Recovery Email] To: ${email} (${user.name}) | OTP Code: ${otp} | Expires: ${expiresAt.toISOString()}`,
    );

    return {
      sent: true,
      email,
      userName: user.name,
      expiresAt: expiresAt.toISOString(),
      demoOtp: otp,
    };
  }

  // body.action === "reset"
  const verification = await prisma.verification.findFirst({
    where: { identifier },
    orderBy: { createdAt: "desc" },
  });

  invariant(
    verification && verification.expiresAt > new Date(),
    "VALIDATION_ERROR",
    "รหัสยืนยันหมดอายุหรือยังไม่ได้ขอรหัสกู้คืน กรุณากดขอรหัสใหม่อีกครั้ง",
    422,
  );

  const expectedHash = hashResetCode(email, body.code);
  invariant(
    verification.value === expectedHash,
    "VALIDATION_ERROR",
    "รหัสยืนยัน 6 หลักไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
    422,
  );

  const context = await auth.$context;
  const passwordHash = await context.password.hash(body.newPassword);
  await context.internalAdapter.updatePassword(user.id, passwordHash);

  await prisma.$transaction([
    prisma.verification.deleteMany({ where: { identifier } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "USER_PASSWORD_RECOVERY",
        entity: "User",
        entityId: user.id,
        reason: "กู้คืนรหัสผ่านด้วยรหัสยืนยันทางอีเมล",
      },
    }),
  ]);

  return {
    reset: true,
    email,
  };
});

