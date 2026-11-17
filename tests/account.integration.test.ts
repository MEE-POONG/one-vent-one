import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

test(
  "HTTP account: isolated profile updates; existing accounts in every role can change to 8-character passwords",
  { skip: process.env.RUN_HTTP_TESTS !== "1" },
  async () => {
    assert.ok(["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname));
    assert.ok(
      ["127.0.0.1", "localhost"].includes(
        new URL(process.env.DATABASE_URL!).hostname,
      ),
    );
    const prisma = new PrismaClient();
    const run = randomBytes(8).toString("hex");
    const email = `profile-${run}@example.invalid`;
    const otherEmail = `other-profile-${run}@example.invalid`;
    const password = randomBytes(8).toString("hex");
    const newPassword = randomBytes(4).toString("hex");
    const send = async (
      path: string,
      body: unknown,
      cookie?: string,
      method = "POST",
      origin = baseURL,
    ) => {
      const request = () =>
        fetch(`${baseURL}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            Origin: origin,
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body: JSON.stringify(body),
        });
      const response = await request();
      if (response.status !== 429) return response;
      // Respect Better Auth's sensitive-endpoint limits without disabling them.
      const retryAfter = Number(response.headers.get("x-retry-after"));
      assert.ok(retryAfter > 0 && retryAfter <= 60);
      await setTimeout(retryAfter * 1000 + 100);
      return request();
    };
    const cookies = (response: Response) =>
      response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
    try {
      assert.equal(
        (await send("/api/me", { name: "Unauthorized" }, undefined, "PATCH"))
          .status,
        401,
      );
      assert.equal(
        (
          await send("/api/auth/change-password", {
            currentPassword: password,
            newPassword,
          })
        ).status,
        401,
      );
      const tooShort = await send("/api/auth/sign-up/email", {
        email,
        password: "short12",
        name: "Profile test",
      });
      assert.equal(tooShort.status, 400);
      assert.equal((await tooShort.json()).code, "PASSWORD_TOO_SHORT");
      const signup = await send("/api/auth/sign-up/email", {
        email,
        password,
        name: "Profile test",
      });
      assert.equal(signup.status, 200);
      const cookie = cookies(signup);
      const other = await send("/api/auth/sign-up/email", {
        email: otherEmail,
        password: randomBytes(4).toString("hex"),
        name: "Other profile test",
      });
      assert.equal(other.status, 200);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      assert.equal(
        (await send("/api/me", { name: "   " }, cookie, "PATCH")).status,
        422,
      );
      assert.equal(
        (await send("/api/me", { name: "x".repeat(81) }, cookie, "PATCH"))
          .status,
        422,
      );
      assert.equal(
        (
          await send(
            "/api/me",
            { name: "New name", roles: ["SUPER_ADMIN"] },
            cookie,
            "PATCH",
          )
        ).status,
        422,
      );
      assert.equal(
        (
          await send(
            "/api/me",
            { name: "New name" },
            cookie,
            "PATCH",
            "https://untrusted.example.invalid",
          )
        ).status,
        403,
      );
      const updated = await send(
        "/api/me",
        { name: "  ชื่อใหม่สำหรับทดสอบ  " },
        cookie,
        "PATCH",
      );
      assert.equal(updated.status, 200);
      assert.equal((await updated.json()).data.name, "ชื่อใหม่สำหรับทดสอบ");
      const session = await fetch(`${baseURL}/api/auth/get-session`, {
        headers: { Cookie: cookie },
      });
      assert.equal((await session.json()).user.name, "ชื่อใหม่สำหรับทดสอบ");
      const unchanged = await prisma.user.findUniqueOrThrow({
        where: { email: otherEmail },
      });
      assert.equal(unchanged.name, "Other profile test");
      assert.deepEqual(
        (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).roles,
        ["CUSTOMER"],
      );
      const secondLogin = await send("/api/auth/sign-in/email", {
        email,
        password,
      });
      assert.equal(secondLogin.status, 200);
      const secondCookie = cookies(secondLogin);
      const wrongPassword = await send(
        "/api/auth/change-password",
        { currentPassword: "incorrect-password", newPassword },
        cookie,
      );
      assert.equal(wrongPassword.status, 400);
      assert.equal((await wrongPassword.json()).code, "INVALID_PASSWORD");
      assert.equal(
        (
          await send(
            "/api/auth/change-password",
            { currentPassword: password, newPassword: "short12" },
            cookie,
          )
        ).status,
        400,
      );
      const changed = await send(
        "/api/auth/change-password",
        { currentPassword: password, newPassword, revokeOtherSessions: true },
        cookie,
      );
      assert.equal(changed.status, 200);
      const currentCookie = cookies(changed);
      const currentSession = await fetch(`${baseURL}/api/auth/get-session`, {
        headers: { Cookie: currentCookie },
      });
      assert.equal((await currentSession.json()).user.id, user.id);
      const revokedSession = await fetch(`${baseURL}/api/auth/get-session`, {
        headers: { Cookie: secondCookie },
      });
      assert.equal(await revokedSession.json(), null);
      assert.equal(
        (await send("/api/auth/sign-in/email", { email, password })).status,
        401,
      );
      assert.equal(
        (
          await send("/api/auth/sign-in/email", {
            email,
            password: newPassword,
          })
        ).status,
        200,
      );
      let roleCookie = currentCookie;
      let currentPassword = newPassword;
      for (const role of ["ADMIN", "SUPER_ADMIN"] as const) {
        await prisma.user.update({
          where: { id: user.id },
          data: { roles: [role] },
        });
        const nextPassword = randomBytes(4).toString("hex");
        const change = await send(
          "/api/auth/change-password",
          {
            currentPassword,
            newPassword: nextPassword,
            revokeOtherSessions: true,
          },
          roleCookie,
        );
        assert.equal(
          change.status,
          200,
          `${role} must be able to change an existing password to 8 characters`,
        );
        roleCookie = cookies(change);
        const login = await send("/api/auth/sign-in/email", {
          email,
          password: nextPassword,
        });
        assert.equal(
          login.status,
          200,
          `${role} must be able to log in with the new 8-character password`,
        );
        assert.deepEqual((await login.json()).user.roles, [role]);
        currentPassword = nextPassword;
      }
    } finally {
      const users = await prisma.user.findMany({
        where: { email: { in: [email, otherEmail] } },
        select: { id: true },
      });
      const ids = users.map((user) => user.id);
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.account.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.$disconnect();
    }
  },
);
