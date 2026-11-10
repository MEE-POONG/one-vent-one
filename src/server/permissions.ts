import "server-only";
import type { Actor } from "@/server/auth";
import type { Role } from "@prisma/client";
import { DomainError } from "./errors";

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
export function requireCheckInEvent(actor: Actor, eventId: string) {
  if (actor.roles.includes("SUPER_ADMIN")) return;
  if (
    !actor.roles.includes("CHECKIN_STAFF") ||
    !actor.assignedEventIds.includes(eventId)
  )
    throw new DomainError(
      "FORBIDDEN",
      "คุณไม่ได้รับสิทธิ์ตรวจบัตรสำหรับงานนี้",
      403,
    );
}
