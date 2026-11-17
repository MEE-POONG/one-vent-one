import "server-only";

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function invariant(
  condition: unknown,
  code: string,
  message: string,
  status = 409,
): asserts condition {
  if (!condition) throw new DomainError(code, message, status);
}

export const notFound = () =>
  new DomainError("NOT_FOUND", "ไม่พบรายการที่ต้องการ", 404);
