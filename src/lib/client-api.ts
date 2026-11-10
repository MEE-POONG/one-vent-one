"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    ...options,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      body?.error?.message || "ไม่สามารถทำรายการได้ กรุณาลองอีกครั้ง",
      body?.error?.code || "REQUEST_FAILED",
      response.status,
      body?.error?.fieldErrors,
    );
  return body.data as T;
}
export function post<T>(
  path: string,
  body: unknown,
  key = crypto.randomUUID(),
) {
  return api<T>(path, {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}
export function useResource<T>(path: string | null, poll = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const reload = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    const current = ++generation.current;
    try {
      const value = await api<T>(path);
      if (current === generation.current) {
        setData(value);
        setError(null);
      }
    } catch (e) {
      if (current === generation.current) {
        setError(e instanceof Error ? e : new Error("โหลดข้อมูลไม่สำเร็จ"));
        if (e instanceof ApiError && [401, 403].includes(e.status))
          setData(null);
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) {
        setLoading(true);
        setData(null);
        void reload();
      }
    });
    const visibility = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const timer = poll
      ? setInterval(() => {
          if (document.visibilityState === "visible") void reload();
        }, poll)
      : null;
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted = false;
      invalidate();
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [reload, poll, invalidate]);
  return { data, error, loading, reload, setData };
}
export function useMutation() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const key = useRef<string | null>(null);
  const fingerprint = useRef<string | null>(null);
  async function run<T>(path: string, body: unknown, method = "POST") {
    setPending(true);
    setError(null);
    try {
      let encoded: string;
      if (body instanceof FormData) {
        const parts = await Promise.all(
          [...body.entries()].map(async ([name, value]) => {
            if (typeof value === "string") return [name, value];
            const digest = await crypto.subtle.digest(
              "SHA-256",
              await value.arrayBuffer(),
            );
            return [
              name,
              value.type,
              value.size,
              Array.from(new Uint8Array(digest), (byte) =>
                byte.toString(16).padStart(2, "0"),
              ).join(""),
            ];
          }),
        );
        encoded = JSON.stringify(parts);
      } else encoded = JSON.stringify(body);
      const print = `${method}:${path}:${encoded}`;
      if (print !== fingerprint.current) {
        fingerprint.current = print;
        key.current = crypto.randomUUID();
      }
      const result = await api<T>(path, {
        method,
        headers: { "Idempotency-Key": key.current! },
        body: body instanceof FormData ? body : JSON.stringify(body),
      });
      fingerprint.current = null;
      key.current = null;
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("ทำรายการไม่สำเร็จ");
      setError(err);
      throw err;
    } finally {
      setPending(false);
    }
  }
  return { run, pending, error, setError };
}
