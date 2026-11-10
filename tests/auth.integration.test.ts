import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const enabled = process.env.RUN_HTTP_TESTS === "1";

test(
  "HTTP Better Auth: public signup cannot set roles; password login/session/logout and admin denial",
  { skip: !enabled },
  async () => {
    assert.ok(
      ["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname),
      "Auth fixtures require a local app server.",
    );
    assert.match(
      process.env.DATABASE_URL ?? "",
      /127\.0\.0\.1|localhost/,
      "Auth cleanup requires the matching local database.",
    );
    const prisma = new PrismaClient();
    const email = `auth-${randomBytes(8).toString("hex")}@example.invalid`;
    const password = randomBytes(24).toString("base64url");
    const post = (path: string, body: unknown, cookie?: string) =>
      fetch(`${baseURL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseURL,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(body),
      });
    try {
      const signup = await post("/api/auth/sign-up/email", {
        name: "Auth integration test",
        email,
        password,
        roles: ["SUPER_ADMIN", "PAYMENT_REVIEWER"],
      });
      assert.equal(
        signup.status,
        200,
        `Signup failed: ${await signup.clone().text()}`,
      );
      const user = await prisma.user.findUniqueOrThrow({
        where: { email },
        include: { accounts: true },
      });
      assert.deepEqual(user.roles, ["CUSTOMER"]);
      assert.notEqual(user.accounts[0].password, password);
      assert.ok(
        user.accounts[0].password && user.accounts[0].password.length > 50,
      );
      const login = await post("/api/auth/sign-in/email", { email, password });
      assert.equal(login.status, 200);
      const cookie = login.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      assert.ok(cookie.includes("session_token"));
      const sessions = await Promise.all(
        Array.from({ length: 8 }, () =>
          fetch(`${baseURL}/api/auth/get-session`, {
            headers: { Cookie: cookie },
          }),
        ),
      );
      for (const response of sessions) {
        assert.equal(response.status, 200, "Concurrent session lookup failed");
        const session = await response.json();
        assert.equal(session.user.id, user.id);
        assert.deepEqual(session.user.roles, ["CUSTOMER"]);
      }
      const admin = await fetch(`${baseURL}/api/admin/events`, {
        headers: { Cookie: cookie },
      });
      assert.equal(admin.status, 403);
      await prisma.user.update({
        where: { id: user.id },
        data: { roles: ["CUSTOMER", "EVENT_MANAGER"] },
      });
      const granted = await fetch(`${baseURL}/api/admin/events`, {
        headers: { Cookie: cookie },
      });
      assert.equal(
        granted.status,
        200,
        "Role grants must take effect on the current session",
      );
      const crossSite = await fetch(`${baseURL}/api/admin/events`, {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: "https://untrusted.example.invalid",
          "Content-Type": "application/json",
          "Idempotency-Key": randomBytes(16).toString("hex"),
        },
        body: "{}",
      });
      assert.equal(
        crossSite.status,
        403,
        "Cross-origin mutations must be rejected before business input",
      );
      await prisma.user.update({
        where: { id: user.id },
        data: { roles: ["CUSTOMER"] },
      });
      const revoked = await fetch(`${baseURL}/api/admin/events`, {
        headers: { Cookie: cookie },
      });
      assert.equal(
        revoked.status,
        403,
        "Role revocation must take effect on the current session",
      );
      const logout = await post("/api/auth/sign-out", {}, cookie);
      assert.equal(logout.status, 200);
      const expired = await fetch(`${baseURL}/api/auth/get-session`, {
        headers: { Cookie: cookie },
      });
      assert.equal(await expired.json(), null);
    } finally {
      const fixture = await prisma.user.findUnique({ where: { email } });
      if (fixture?.name === "Auth integration test") {
        await prisma.session.deleteMany({ where: { userId: fixture.id } });
        await prisma.account.deleteMany({ where: { userId: fixture.id } });
        await prisma.user.delete({ where: { id: fixture.id } });
      }
      await prisma.$disconnect();
    }
  },
);
