import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { DomainError } from "./errors";
import { isTrustedOrigin } from "./origins";

export type RouteContext = { params: Promise<Record<string, string>> };

export function assertOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (
    (origin && !isTrustedOrigin(origin)) ||
    (!origin && request.headers.has("cookie")) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new DomainError("FORBIDDEN", "คำขอไม่ได้มาจากเว็บไซต์นี้", 403);
  }
}

export function api<T>(
  handler: (request: Request, context: RouteContext) => Promise<T>,
) {
  return async (request: Request, context: RouteContext) => {
    const requestId = randomUUID();
    try {
      assertOrigin(request);
      const result = await handler(request, context);
      if (result instanceof Response) return result;
      return NextResponse.json(
        { data: result },
        {
          headers: {
            "Cache-Control": "private, no-store",
            "X-Request-Id": requestId,
          },
        },
      );
    } catch (error) {
      let safe: DomainError;
      if (error instanceof DomainError) safe = error;
      else if (error instanceof ZodError)
        safe = new DomainError(
          "VALIDATION_ERROR",
          "กรุณาตรวจสอบข้อมูลที่กรอก",
          422,
          error.flatten().fieldErrors as Record<string, string[]>,
        );
      else if (error instanceof SyntaxError)
        safe = new DomainError(
          "VALIDATION_ERROR",
          "รูปแบบข้อมูลไม่ถูกต้อง",
          400,
        );
      else if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      )
        safe = new DomainError(
          "CONFLICT",
          "ข้อมูลนี้มีอยู่แล้ว กรุณาโหลดข้อมูลใหม่",
          409,
        );
      else {
        // Never log inputs, database error payloads, sessions, credentials or evidence.
        console.error("Request failed", {
          requestId,
          kind: error instanceof Error ? error.name : "UnknownError",
        });
        safe = new DomainError(
          "SERVICE_UNAVAILABLE",
          "ระบบยังไม่พร้อม กรุณาลองใหม่อีกครั้ง",
          503,
        );
      }
      return NextResponse.json(
        {
          error: {
            code: safe.code,
            message: safe.message,
            fieldErrors: safe.fieldErrors,
            requestId,
          },
        },
        {
          status: safe.status,
          headers: {
            "Cache-Control": "private, no-store",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  };
}

export async function readBody(
  request: Request,
  maxBytes = 64 * 1024,
): Promise<Uint8Array> {
  const length = Number(request.headers.get("content-length"));
  if (length > maxBytes)
    throw new DomainError(
      "PAYLOAD_TOO_LARGE",
      "ไฟล์หรือข้อมูลมีขนาดใหญ่เกินกำหนด",
      413,
    );
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new DomainError(
        "PAYLOAD_TOO_LARGE",
        "ไฟล์หรือข้อมูลมีขนาดใหญ่เกินกำหนด",
        413,
      );
    }
    chunks.push(chunk.value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export async function readJson<T>(request: Request, schema: ZodType<T>) {
  return schema.parse(
    JSON.parse(new TextDecoder().decode(await readBody(request))),
  );
}

export function idempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key");
  if (!key || !/^[a-zA-Z0-9:_-]{8,128}$/.test(key))
    throw new DomainError(
      "VALIDATION_ERROR",
      "ต้องมี Idempotency-Key ความยาว 8–128 ตัวอักษร",
      422,
    );
  return key;
}

export function pagination(request: Request) {
  const query = new URL(request.url).searchParams;
  const page = Number(query.get("page") || 1);
  const pageSize = Number(query.get("pageSize") || 20);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  )
    throw new DomainError(
      "VALIDATION_ERROR",
      "เลขหน้าหรือจำนวนรายการไม่ถูกต้อง",
      422,
    );
  return { page, pageSize, skip: (page - 1) * pageSize };
}
