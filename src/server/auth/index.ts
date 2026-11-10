import "server-only";
import { setTimeout } from "node:timers/promises";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { headers } from "next/headers";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";
const createAdapter = prismaAdapter(prisma, { provider: "mongodb" });

export const auth = betterAuth({
  appName: "OneVentOne",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: (options: BetterAuthOptions) => {
    const adapter = createAdapter(options);
    return {
      ...adapter,
      async incrementOne<T>(input: Parameters<typeof adapter.incrementOne>[0]) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await adapter.incrementOne<T>(input);
          } catch (error) {
            // Retry the whole conditional increment after MongoDB aborts its transaction.
            if (
              input.model !== "rateLimit" ||
              !(error instanceof Prisma.PrismaClientKnownRequestError) ||
              error.code !== "P2034" ||
              attempt >= 5
            )
              throw error;
            await setTimeout(20 * 2 ** attempt + Math.floor(Math.random() * 30));
          }
        }
      },
    };
  },
  trustedOrigins: [baseURL],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    // A reset mail handler is deliberately not registered until a real mail service exists.
  },
  user: {
    additionalFields: {
      roles: {
        type: "string[]",
        defaultValue: ["CUSTOMER"],
        required: false,
        input: false,
      },
    },
  },
  advanced: {
    database: { generateId: false },
    ipAddress: {
      ipAddressHeaders: process.env.TRUSTED_CLIENT_IP_HEADER
        ? [process.env.TRUSTED_CLIENT_IP_HEADER]
        : [],
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
});

export type Actor = { id: string; roles: Role[]; assignedEventIds: string[] };

export async function requireActor(request?: Request): Promise<Actor> {
  const session = await auth.api.getSession({
    headers: request?.headers ?? (await headers()),
  });
  if (!session)
    throw new DomainError(
      "UNAUTHENTICATED",
      "กรุณาเข้าสู่ระบบก่อนทำรายการ",
      401,
    );
  // Always load current permissions. A role removed by an administrator takes effect immediately.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      roles: true,
      assignments: { select: { eventId: true } },
    },
  });
  if (!user) throw new DomainError("UNAUTHENTICATED", "ไม่พบบัญชีผู้ใช้", 401);
  return {
    id: user.id,
    roles: user.roles,
    assignedEventIds: user.assignments.map((a) => a.eventId),
  };
}
