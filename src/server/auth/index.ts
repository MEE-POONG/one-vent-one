import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { cookies, headers } from "next/headers";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { trustedOrigins } from "@/server/origins";

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
            await setTimeout(
              20 * 2 ** attempt + Math.floor(Math.random() * 30),
            );
          }
        }
      },
    };
  },
  trustedOrigins,
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

export type Actor = {
  id: string;
  roles: Role[];
  isGuest?: boolean;
  guestActorId?: string;
};

const GUEST_COOKIE_NAME = "ovo_guest_actor";

function guestSigningSecret() {
  return (
    process.env.BETTER_AUTH_SECRET ||
    process.env.TICKET_ENCRYPTION_KEY ||
    "oneventone-guest-signing-secret"
  );
}

function signGuestUserId(userId: string) {
  const mac = createHmac("sha256", guestSigningSecret())
    .update(`guest:${userId}`)
    .digest("base64url");
  return `${userId}.${mac}`;
}

function verifyGuestCookie(raw?: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [userId, mac] = parts;
  if (!/^[a-f\d]{24}$/i.test(userId) || !mac) return null;
  const expected = createHmac("sha256", guestSigningSecret())
    .update(`guest:${userId}`)
    .digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

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
    select: { id: true, roles: true },
  });
  if (!user) throw new DomainError("UNAUTHENTICATED", "ไม่พบบัญชีผู้ใช้", 401);
  return { id: user.id, roles: user.roles };
}

export async function requireCustomerOrGuestActor(
  request?: Request,
  options: { createIfMissing?: boolean } = {},
): Promise<Actor> {
  const reqHeaders = request?.headers ?? (await headers());
  const cookieStore = await cookies();
  const rawGuestCookie = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  const verifiedGuestId = verifyGuestCookie(rawGuestCookie);

  const session = await auth.api.getSession({ headers: reqHeaders });
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, roles: true },
    });
    if (user) {
      return {
        id: user.id,
        roles: user.roles,
        isGuest: false,
        guestActorId: verifiedGuestId ?? undefined,
      };
    }
  }

  if (verifiedGuestId) {
    const guestUser = await prisma.user.findUnique({
      where: { id: verifiedGuestId },
      select: { id: true, roles: true },
    });
    if (guestUser) {
      return { id: guestUser.id, roles: guestUser.roles, isGuest: true };
    }
  }

  if (!options.createIfMissing) {
    throw new DomainError(
      "UNAUTHENTICATED",
      "ไม่พบเซสชันการจอง กรุณาเลือกที่นั่งและทำรายการใหม่อีกครั้ง",
      401,
    );
  }

  const createdGuest = await prisma.user.create({
    data: {
      name: "ลูกค้าทั่วไป (Guest)",
      email: `guest-${randomUUID()}@guest.oneventone.local`,
      roles: ["CUSTOMER"],
    },
    select: { id: true, roles: true },
  });

  cookieStore.set(GUEST_COOKIE_NAME, signGuestUserId(createdGuest.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return { id: createdGuest.id, roles: createdGuest.roles, isGuest: true };
}
