// Client-side mirror of src/server/permissions.ts. Only decides what to show;
// the server re-checks every request.
export type AccessLevel = "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";

export const accessLevelLabels: Record<AccessLevel, string> = {
  CUSTOMER: "ลูกค้า",
  ADMIN: "แอดมิน (พนักงานดูแลเว็บ)",
  SUPER_ADMIN: "ผู้ดูแลสูงสุด (เจ้าของร้าน)",
};

export function rolesOf(session: unknown): string[] {
  const user = (session as { user?: { roles?: unknown } } | null)?.user;
  return Array.isArray(user?.roles) ? (user.roles as string[]) : [];
}
export const isOwner = (roles: string[]) => roles.includes("SUPER_ADMIN");
export const isStaff = (roles: string[]) =>
  isOwner(roles) || roles.includes("ADMIN");
export const accessLevel = (roles: string[]): AccessLevel =>
  isOwner(roles)
    ? "SUPER_ADMIN"
    : roles.includes("ADMIN")
      ? "ADMIN"
      : "CUSTOMER";
