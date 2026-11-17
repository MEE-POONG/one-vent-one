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
import { hasRole } from "@/server/permissions";

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
    minPasswordLength: 8,
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
const GUEST_EMAIL_DOMAIN = "@guest.oneventone.local";

// Guest cookies are signed with the auth secret only. There is deliberately no
// fallback key: a key written in the source would let anyone forge a cookie
// for any account id.
function guestSigningSecret() {
  return process.env.BETTER_AUTH_SECRET || null;
}

function requireGuestSigningSecret() {
  const secret = guestSigningSecret();
  if (!secret)
    throw new DomainError(
      "SERVICE_UNAVAILABLE",
      "ระบบยังไม่ได้ตั้งค่ากุญแจรักษาความปลอดภัย",
      503,
    );
  return secret;
}

function signGuestUserId(userId: string) {
  const mac = createHmac("sha256", requireGuestSigningSecret())
    .update(`guest:${userId}`)
    .digest("base64url");
  return `${userId}.${mac}`;
}

function verifyGuestCookie(raw?: string | null): string | null {
  const secret = guestSigningSecret();
  if (!raw || !secret) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [userId, mac] = parts;
  if (!/^[a-f\d]{24}$/i.test(userId) || !mac) return null;
  const expected = createHmac("sha256", secret)
    .update(`guest:${userId}`)
    .digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

// A guest cookie may only ever stand for a guest account. Even a correctly
// signed cookie naming a registered user (staff included) is ignored.
async function guestAccountId(userId: string | null) {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email.endsWith(GUEST_EMAIL_DOMAIN) ? userId : null;
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

/**
 * The signed-in staff member (ADMIN or SUPER_ADMIN), or null for anyone else,
 * signed out included. For deciding whether to render back-office pages; the
 * API still checks permissions on every request.
 */
export async function currentStaff(
  request?: Request,
): Promise<Actor | null> {
  try {
    const actor = await requireActor(request);
    return hasRole(actor, "ADMIN") ? actor : null;
  } catch (error) {
    if (error instanceof DomainError && error.status === 401) return null;
    throw error;
  }
}

export async function requireCustomerOrGuestActor(
  request?: Request,
  options: { createIfMissing?: boolean } = {},
): Promise<Actor> {
  const reqHeaders = request?.headers ?? (await headers());
  const cookieStore = await cookies();
  const rawGuestCookie = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  const verifiedGuestId = await guestAccountId(
    verifyGuestCookie(rawGuestCookie),
  );

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

  // A guest never carries more than customer rights, whatever the stored row says.
  if (verifiedGuestId)
    return { id: verifiedGuestId, roles: ["CUSTOMER"], isGuest: true };

  if (!options.createIfMissing) {
    throw new DomainError(
      "UNAUTHENTICATED",
      "ไม่พบเซสชันการจอง กรุณาเลือกที่นั่งและทำรายการใหม่อีกครั้ง",
      401,
    );
  }

  // Fail before writing, so a missing key never leaves an orphan guest row.
  requireGuestSigningSecret();
  const createdGuest = await prisma.user.create({
    data: {
      name: "ลูกค้าทั่วไป (Guest)",
      email: `guest-${randomUUID()}${GUEST_EMAIL_DOMAIN}`,
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
