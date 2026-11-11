import "server-only";

/**
 * Origins allowed to send cookie-authenticated mutations (Better Auth and /api).
 *
 * - BETTER_AUTH_URL is always trusted.
 * - Outside production, its localhost <-> 127.0.0.1 twin is trusted too: browsers
 *   treat them as different origins, and opening the other one otherwise fails
 *   sign-in with "Invalid origin".
 * - TRUSTED_ORIGINS (comma separated) adds more, e.g. a LAN address for testing on
 *   a phone. Never list origins you do not control.
 */
function buildTrustedOrigins() {
  const base = new URL(process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000");
  const origins = new Set([base.origin]);
  if (process.env.NODE_ENV !== "production") {
    const twin = { "127.0.0.1": "localhost", localhost: "127.0.0.1" }[
      base.hostname
    ];
    if (twin) {
      const alias = new URL(base.origin);
      alias.hostname = twin;
      origins.add(alias.origin);
    }
  }
  for (const raw of (process.env.TRUSTED_ORIGINS ?? "").split(",")) {
    const value = raw.trim();
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      console.warn("Ignoring invalid entry in TRUSTED_ORIGINS");
    }
  }
  return [...origins];
}

export const trustedOrigins = buildTrustedOrigins();
export const isTrustedOrigin = (origin: string) =>
  trustedOrigins.includes(origin);
