/**
 * Server-side administrator tools. Anyone who can run this already has database
 * access, so these commands are the recovery path when no one can sign in to /admin
 * (there is no e-mail password reset until a mail service is configured).
 *
 *   npm run admin:list                         list staff/admin accounts
 *   npm run admin:create                       create a new SUPER_ADMIN account
 *   npm run admin:promote -- <email>           give an existing account SUPER_ADMIN
 *   npm run admin:reset-password -- <email>    set a new password, sign out everywhere
 *
 * Prompts interactively. For non-interactive use set BOOTSTRAP_ADMIN_EMAIL /
 * BOOTSTRAP_ADMIN_PASSWORD (create) or ADMIN_NEW_PASSWORD (reset-password), and
 * pass --yes to skip confirmation.
 */
import "dotenv/config";
import readline from "node:readline";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const prisma = new PrismaClient();
const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "mongodb" }),
  advanced: { database: { generateId: false } },
  // Must match src/server/auth so hashes and length rules agree.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD,
    maxPasswordLength: MAX_PASSWORD,
  },
});

const args = process.argv.slice(2);
const command = args[0];
const assumeYes = args.includes("--yes");
const positional = args.slice(1).filter((a) => !a.startsWith("--"));

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

/** Reads a line without echoing it. Falls back to a plain read when stdin is piped. */
function askHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) return ask(question);
  return new Promise((resolve, reject) => {
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const done = (error?: Error) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done();
        if (ch === "\u0003") return done(new Error("ยกเลิกโดยผู้ใช้"));
        if (ch === "\u007f" || ch === "\b") {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else if (ch >= " ") {
          value += ch;
          process.stdout.write("*");
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function readEmail(fallback?: string) {
  if (!fallback && !process.stdin.isTTY)
    throw new Error("ระบุอีเมล เช่น npm run admin:promote -- you@example.com");
  const email = (fallback || (await ask("อีเมล: "))).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("รูปแบบอีเมลไม่ถูกต้อง");
  return email;
}

async function readNewPassword(envValue?: string) {
  if (envValue) {
    checkPassword(envValue);
    return envValue;
  }
  if (!process.stdin.isTTY)
    throw new Error(
      "ไม่ได้รันใน terminal แบบโต้ตอบ ตั้งรหัสผ่านผ่าน environment variable แทน",
    );
  const first = await askHidden(
    `รหัสผ่านใหม่ (อย่างน้อย ${MIN_PASSWORD} ตัวอักษร): `,
  );
  checkPassword(first);
  const second = await askHidden("ยืนยันรหัสผ่านอีกครั้ง: ");
  if (first !== second) throw new Error("รหัสผ่านสองครั้งไม่ตรงกัน");
  return first;
}

function checkPassword(password: string) {
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD)
    throw new Error(`รหัสผ่านต้องยาว ${MIN_PASSWORD}–${MAX_PASSWORD} ตัวอักษร`);
}

async function confirm(message: string) {
  if (assumeYes) return;
  // Without a terminal nobody can answer; fail fast instead of waiting forever.
  if (!process.stdin.isTTY)
    throw new Error(
      "ไม่ได้รันใน terminal แบบโต้ตอบ ใส่ --yes เพื่อยืนยันคำสั่ง",
    );
  const answer = await ask(`${message} พิมพ์ yes เพื่อยืนยัน: `);
  if (answer.toLowerCase() !== "yes") throw new Error("ยกเลิกคำสั่ง");
}

function warnIfRemote() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/127\.0\.0\.1|localhost/.test(url))
    console.warn(
      "⚠ DATABASE_URL ไม่ใช่ฐานข้อมูลในเครื่อง คำสั่งนี้จะมีผลกับฐานข้อมูลจริง",
    );
}

async function list() {
  const users = await prisma.user.findMany({
    where: { roles: { hasSome: ["SUPER_ADMIN", "ADMIN"] } },
    select: { email: true, name: true, roles: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  if (!users.length) {
    console.log(
      "ยังไม่มีบัญชีเจ้าหน้าที่ ใช้ npm run admin:create เพื่อสร้างผู้ดูแล",
    );
    return;
  }
  console.table(
    users.map((u) => ({
      email: u.email,
      name: u.name,
      roles: u.roles.filter((r) => r !== "CUSTOMER").join(", "),
      created: u.createdAt.toISOString().slice(0, 10),
    })),
  );
}

async function create() {
  warnIfRemote();
  const email = await readEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists?.roles.includes("SUPER_ADMIN")) {
    // Idempotent like the original bootstrap: no password or role is changed.
    console.log(
      `บัญชีนี้เป็นผู้ดูแลอยู่แล้ว ไม่มีการเปลี่ยนแปลง ถ้าลืมรหัสผ่านใช้ npm run admin:reset-password -- ${email}`,
    );
    return;
  }
  // Never silently promote a public account here (someone may have registered the
  // address first). Promotion is the separate, explicit admin:promote command.
  if (exists)
    throw new Error(
      `มีบัญชีลูกค้า ${email} อยู่แล้ว ถ้าเป็นบัญชีของคุณจริงใช้ npm run admin:promote -- ${email}`,
    );
  const name =
    process.env.BOOTSTRAP_ADMIN_NAME ||
    (process.stdin.isTTY ? await ask("ชื่อที่แสดง (เว้นว่างได้): ") : "") ||
    "ผู้ดูแล OneVentOne";
  const password = await readNewPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD);
  const result = await auth.api.signUpEmail({
    body: { email, password, name },
  });
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: result.user.id },
      data: { roles: ["CUSTOMER", "SUPER_ADMIN"] },
    });
    // signUpEmail auto-signs-in; that session token is never handed to anyone.
    await tx.session.deleteMany({ where: { userId: result.user.id } });
    await tx.auditLog.create({
      data: {
        actorId: result.user.id,
        action: "BOOTSTRAP_ADMIN",
        entity: "User",
        entityId: result.user.id,
        reason: "Explicit administrator bootstrap (CLI)",
      },
    });
  });
  console.log(
    `สร้างผู้ดูแล ${email} แล้ว เข้าสู่ระบบที่ /login แล้วเปิด /admin`,
  );
}

async function promote() {
  warnIfRemote();
  const email = await readEmail(positional[0]);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user)
    throw new Error(
      "ไม่พบบัญชีนี้ ให้สมัครที่ /register ก่อน หรือใช้ npm run admin:create",
    );
  if (user.roles.includes("SUPER_ADMIN")) {
    console.log("บัญชีนี้เป็นผู้ดูแลสูงสุดอยู่แล้ว ไม่มีการเปลี่ยนแปลง");
    return;
  }
  console.log(
    `บัญชี: ${user.name} <${user.email}> บทบาทปัจจุบัน: ${user.roles.join(", ")}`,
  );
  await confirm("ให้สิทธิ์ผู้ดูแลสูงสุด (SUPER_ADMIN) กับบัญชีนี้?");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      // One access level per account (see rolesFor in administration.ts).
      data: { roles: ["CUSTOMER", "SUPER_ADMIN"] },
    });
    await tx.auditLog.create({
      data: {
        action: "CLI_PROMOTE_ADMIN",
        entity: "User",
        entityId: user.id,
        reason: "Promoted by server operator via npm run admin:promote",
        changes: { before: user.roles },
      },
    });
  });
  console.log("เรียบร้อย สิทธิ์มีผลทันทีกับคำขอถัดไป (ไม่ต้องออกจากระบบ)");
}

async function resetPassword() {
  warnIfRemote();
  const email = await readEmail(positional[0]);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: { where: { providerId: "credential" } } },
  });
  if (!user) throw new Error("ไม่พบบัญชีนี้");
  if (!user.accounts.length)
    throw new Error("บัญชีนี้ไม่ได้ใช้รหัสผ่าน (ไม่มี credential account)");
  console.log(`บัญชี: ${user.name} <${user.email}>`);
  await confirm("ตั้งรหัสผ่านใหม่และออกจากระบบทุกอุปกรณ์ของบัญชีนี้?");
  const password = await readNewPassword(process.env.ADMIN_NEW_PASSWORD);
  const context = await auth.$context;
  const hash = await context.password.hash(password);
  await context.internalAdapter.updatePassword(user.id, hash);
  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.create({
      data: {
        action: "CLI_RESET_PASSWORD",
        entity: "User",
        entityId: user.id,
        reason:
          "Password reset by server operator via npm run admin:reset-password",
      },
    });
  });
  console.log("ตั้งรหัสผ่านใหม่แล้ว เข้าสู่ระบบใหม่ที่ /login");
}

const commands: Record<string, () => Promise<void>> = {
  list,
  create,
  promote,
  "reset-password": resetPassword,
};

async function main() {
  const run = command ? commands[command] : undefined;
  if (!run) {
    console.log(
      "ใช้: tsx scripts/admin.ts <list|create|promote|reset-password> [email] [--yes]",
    );
    process.exitCode = 1;
    return;
  }
  await run();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
