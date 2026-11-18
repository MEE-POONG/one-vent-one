/** Only return local paths, including after URL normalization. */
export function authDestination(
  returnTo?: string,
  fallback = "/account/bookings",
): string {
  if (
    !returnTo?.startsWith("/") ||
    returnTo.startsWith("//") ||
    /[\u0000-\u0020\\]/.test(returnTo)
  )
    return fallback;

  try {
    const base = "https://oneventone.invalid";
    const url = new URL(returnTo, base);
    if (
      url.origin !== base ||
      url.pathname.startsWith("//") ||
      url.pathname === "/auth/complete" ||
      url.pathname.startsWith("/auth/complete/")
    )
      return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
