import test from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { authDestination } from "../src/lib/auth-redirect";

test("auth destinations preserve bookings and reject external redirects and loops", () => {
  assert.equal(
    authDestination("/events/live/booking?zone=front#seats"),
    "/events/live/booking?zone=front#seats",
  );
  for (const destination of [
    undefined,
    "https://evil.invalid/",
    "//evil.invalid/",
    "/\\evil.invalid/",
    "/\n/evil.invalid/",
    "/a/..//evil.invalid/",
    "/auth/complete?next=/auth/complete",
    "/a/../auth/complete",
  ]) {
    assert.equal(authDestination(destination), "/account/bookings");
    assert.equal(authDestination(destination, "/admin"), "/admin");
  }
});

test("Google OAuth: PKCE, state binding, cancellation, sessions and existing account linking", async (t) => {
  // Exercise the application's auth options with an isolated in-memory database.
  // Only Google's token endpoint is mocked; no real Google account is used.
  const previous = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  };
  process.env.GOOGLE_CLIENT_ID = "google-test.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "google-test-secret";
  process.env.BETTER_AUTH_SECRET =
    "isolated-google-test-secret-0123456789abcdef";
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const { auth: applicationAuth } = await import("../src/server/auth");
  const baseURL = "http://localhost:3333";
  const instance = betterAuth({
    ...applicationAuth.options,
    baseURL,
    database: memoryAdapter({
      user: [],
      account: [],
      session: [],
      verification: [],
    }),
    trustedOrigins: [baseURL],
    advanced: {
      ...applicationAuth.options.advanced,
      database: { generateId: "uuid" },
      // Better Auth relaxes origin checks automatically under node:test.
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
    rateLimit: { enabled: false },
    logger: { disabled: true },
  });
  const cookies = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  const post = (body: unknown, origin = baseURL) =>
    instance.handler(
      new Request(`${baseURL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: "test_client=1",
        },
        body: JSON.stringify(body),
      }),
    );
  const callbackURL = `${baseURL}/auth/complete?next=%2Fevents%2Flive%2Fbooking`;
  const errorCallbackURL = `${baseURL}/login?next=%2Fevents%2Flive%2Fbooking`;
  const body = { provider: "google", callbackURL, errorCallbackURL };
  const begin = async () => {
    const response = await post(body);
    assert.equal(response.status, 200, await response.clone().text());
    const url = new URL((await response.json()).url);
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(
      url.searchParams.get("client_id"),
      process.env.GOOGLE_CLIENT_ID,
    );
    assert.equal(
      url.searchParams.get("redirect_uri"),
      `${baseURL}/api/auth/callback/google`,
    );
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.ok(url.searchParams.get("code_challenge"));
    assert.deepEqual(url.searchParams.get("scope")?.split(" ").sort(), [
      "email",
      "openid",
      "profile",
    ]);
    return { state: url.searchParams.get("state")!, cookie: cookies(response) };
  };
  const callback = (state: string, cookie: string, query = "code=test-code") =>
    instance.handler(
      new Request(
        `${baseURL}/api/auth/callback/google?state=${encodeURIComponent(state)}&${query}`,
        { headers: { Cookie: cookie } },
      ),
    );

  assert.equal((await post(body, "https://evil.invalid")).status, 403);
  assert.equal(
    (await post({ ...body, callbackURL: "https://evil.invalid" })).status,
    403,
  );
  assert.equal(
    (await post({ ...body, errorCallbackURL: "https://evil.invalid" })).status,
    403,
  );

  const cancelled = await begin();
  const cancellation = await callback(
    cancelled.state,
    cancelled.cookie,
    "error=access_denied",
  );
  const cancellationURL = new URL(cancellation.headers.get("location")!);
  assert.equal(cancellationURL.pathname, "/login");
  assert.equal(cancellationURL.searchParams.get("error"), "access_denied");
  assert.equal(
    cancellationURL.searchParams.get("next"),
    "/events/live/booking",
  );

  const unbound = await begin();
  const rejected = await callback(unbound.state, "");
  assert.equal(
    new URL(rejected.headers.get("location")!).searchParams.get("error"),
    "state_mismatch",
  );
  assert.ok(!cookies(rejected).includes("session_token"));

  let tokenRequests = 0;
  let googleSubject = "google-test-user";
  let googleEmail = "google-customer@example.invalid";
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(input), "https://oauth2.googleapis.com/token");
      const params = new URLSearchParams(String(init?.body));
      assert.equal(params.get("code"), "test-code");
      assert.ok(params.get("code_verifier"));
      assert.equal(
        params.get("redirect_uri"),
        `${baseURL}/api/auth/callback/google`,
      );
      tokenRequests++;
      const encode = (value: unknown) =>
        Buffer.from(JSON.stringify(value)).toString("base64url");
      return Response.json({
        access_token: "mock-google-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid email profile",
        id_token: `${encode({ alg: "RS256" })}.${encode({
          sub: googleSubject,
          name: "Google customer",
          email: googleEmail,
          email_verified: true,
          roles: ["SUPER_ADMIN"],
        })}.mock-token-endpoint-signature`,
      });
    },
  );
  const signIn = async () => {
    const flow = await begin();
    const response = await callback(flow.state, flow.cookie);
    assert.equal(response.headers.get("location"), callbackURL);
    assert.ok(cookies(response).includes("session_token"));
    const session = await instance.api.getSession({
      headers: new Headers({ Cookie: cookies(response) }),
    });
    assert.ok(session);
    return session;
  };

  const customer = await signIn();
  assert.equal(customer.user.email, "google-customer@example.invalid");
  assert.deepEqual(customer.user.roles, ["CUSTOMER"]);
  assert.equal((await signIn()).user.id, customer.user.id);
  assert.equal(tokenRequests, 2);

  // Keep Better Auth's protection for existing, unverified local accounts.
  const { user: staff } = await instance.api.signUpEmail({
    body: {
      name: "Existing staff",
      email: "existing-staff@example.invalid",
      password: "existing-staff-test-password",
    },
  });
  const context = await instance.$context;
  await context.internalAdapter.updateUser(staff.id, { roles: ["ADMIN"] });
  googleSubject = "existing-staff-google-subject";
  googleEmail = staff.email;
  const unverifiedFlow = await begin();
  const unverified = await callback(
    unverifiedFlow.state,
    unverifiedFlow.cookie,
  );
  assert.equal(
    new URL(unverified.headers.get("location")!).searchParams.get("error"),
    "account_not_linked",
  );
  assert.ok(!cookies(unverified).includes("session_token"));

  // Once both email identities are verified, linking preserves user and roles.
  await context.internalAdapter.updateUser(staff.id, { emailVerified: true });
  const linked = await signIn();
  assert.equal(linked.user.id, staff.id);
  assert.deepEqual(linked.user.roles, ["ADMIN"]);
});
