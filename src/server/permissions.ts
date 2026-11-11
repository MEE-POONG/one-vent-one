import "server-only";
import type { Actor } from "@/server/auth";
import type { Role } from "@prisma/client";
import { DomainError } from "./errors";

// Three roles for a single shop:
//   SUPER_ADMIN  shop owner: everything, plus staff, shop settings and audit log
//   ADMIN        shop staff: events, bookings, payments, refunds, check-in, reports
//   CUSTOMER     books tickets and sees only their own bookings
// SUPER_ADMIN passes every check, so requireRoles(actor, "ADMIN") means "staff".

export function hasRole(actor: Actor, ...roles: Role[]) {
  return (
    actor.roles.includes("SUPER_ADMIN") ||
    roles.some((role) => actor.roles.includes(role))
  );
}
export function requireRoles(actor: Actor, ...roles: Role[]) {
  if (!hasRole(actor, ...roles))
    throw new DomainError("FORBIDDEN", "คุณไม่มีสิทธิ์ดำเนินการนี้", 403);
}
