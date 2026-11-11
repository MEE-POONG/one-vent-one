"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Camera, CheckCircle2, ScanLine } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import { useMutation, useResource } from "@/lib/client-api";
import type { EventData, PageData } from "@/lib/client-types";
import {
  dateTime,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  PageHeading,
  Pagination,
} from "@/components/ui";

type CheckInResult = { ticketId: string; status: string; usedAt: string };

export function CheckInDesk() {
  const [page, setPage] = useState(1);
  const events = useResource<PageData<EventData>>(
    `/api/admin/events?page=${page}&pageSize=50`,
  );
  const mutation = useMutation();
  const [eventId, setEventId] = useState("");
  const [token, setToken] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [cameraError, setCameraError] = useState<Error | null>(null);
  const [cameraState, setCameraState] = useState<"off" | "starting" | "on">(
    "off",
  );
  const scanner = useRef<Html5Qrcode | null>(null);
  const scanningPaused = useRef(false);
  const busy = useRef(false);
  const disposed = useRef(false);
  const currentEvent = useRef("");
  const cameraId = `qr-camera-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      const active = scanner.current;
      if (active?.isScanning)
        void active
          .stop()
          .then(() => active.clear())
          .catch(() => {});
    };
  }, []);

  async function stopCamera() {
    const active = scanner.current;
    scanner.current = null;
    if (active) {
      try {
        if (active.isScanning) await active.stop();
        active.clear();
      } catch {}
    }
    setCameraState("off");
  }

  async function submit(raw: string, selectedEvent = currentEvent.current) {
    if (busy.current) return;
    if (!selectedEvent || !/^[A-Za-z0-9_-]{43}$/.test(raw.trim())) {
      setCameraError(
        new Error(
          "กรุณาเลือกงานและใช้รหัสบัตร 43 ตัวอักษรจาก QR ของ OneVentOne",
        ),
      );
      return;
    }
    busy.current = true;
    scanningPaused.current = true;
    setResult(null);
    setCameraError(null);
    try {
      setResult(
        await mutation.run<CheckInResult>("/api/check-in", {
          eventId: selectedEvent,
          token: raw.trim(),
        }),
      );
    } catch {
    } finally {
      busy.current = false;
    }
  }

  async function startCamera() {
    if (!eventId || cameraState !== "off") return;
    setCameraError(null);
    setCameraState("starting");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (disposed.current) return;
      const active = new Html5Qrcode(cameraId, { verbose: false });
      scanner.current = active;
      await active.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          if (scanningPaused.current || disposed.current) return;
          scanningPaused.current = true;
          setToken(decoded);
          void submit(decoded);
        },
        () => {},
      );
      if (disposed.current) {
        await active.stop();
        active.clear();
        return;
      }
      setCameraState("on");
    } catch {
      if (!disposed.current) {
        setCameraState("off");
        setCameraError(
          new Error(
            "เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง หรือกรอกรหัสบัตรด้านล่าง",
          ),
        );
      }
    }
  }

  function nextTicket() {
    setToken("");
    setResult(null);
    setCameraError(null);
    mutation.setError(null);
    scanningPaused.current = false;
  }

  return (
    <>
      <PageHeading
        title="ตรวจบัตรเข้างาน"
        description="เลือกอีเวนท์ก่อนสแกน ระบบตรวจบัตรกับข้อมูลล่าสุด และใช้แต่ละบัตรได้ครั้งเดียว"
      />
      <ErrorNotice error={events.error} retry={events.reload} />
      {events.loading ? (
        <Loading />
      ) : events.data?.items.length ? (
        <div className="panel stack">
          <Field label="อีเวนท์ที่ตรวจบัตร">
            <select
              value={eventId}
              disabled={mutation.pending || cameraState === "starting"}
              onChange={(e) => {
                currentEvent.current = e.target.value;
                setEventId(e.target.value);
                nextTicket();
                void stopCamera();
              }}
            >
              <option value="">เลือกอีเวนท์</option>
              {events.data.items.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} · {dateTime(event.startsAt)}
                </option>
              ))}
            </select>
          </Field>
          {events.data.total > events.data.pageSize ? (
            <Pagination {...events.data} onChange={setPage} />
          ) : null}
          <div className="notice">
            <ScanLine size={20} />
            <p>
              เมื่อมีผลตรวจ ให้ตรวจข้อความบนหน้าจอก่อนกด “ตรวจบัตรถัดไป”
              การส่งซ้ำจากปัญหาเครือข่ายจะใช้คำขอเดิม
            </p>
          </div>
          <div
            id={cameraId}
            style={{
              width: "100%",
              maxWidth: 520,
              minHeight: cameraState === "off" ? 0 : 280,
              marginInline: "auto",
              overflow: "hidden",
              borderRadius: 12,
            }}
          />
          <div className="actions">
            <button
              className="button button-outline"
              disabled={!eventId || cameraState === "starting"}
              onClick={() => {
                if (cameraState === "on") void stopCamera();
                else void startCamera();
              }}
            >
              <Camera size={18} />
              {cameraState === "starting"
                ? "กำลังเปิดกล้อง"
                : cameraState === "on"
                  ? "ปิดกล้อง"
                  : "เปิดกล้องสแกน"}
            </button>
          </div>
          <form
            className="stack-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(token);
            }}
          >
            <Field
              label="รหัสบัตร"
              hint="กรอกรหัสที่แสดงใต้ QR ได้เมื่อใช้กล้องไม่ได้"
            >
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={43}
                required
                placeholder="รหัสบัตร 43 ตัวอักษร"
              />
            </Field>
            <div className="actions">
              <button
                className="button"
                disabled={
                  !eventId ||
                  token.trim().length !== 43 ||
                  mutation.pending ||
                  Boolean(result)
                }
              >
                {mutation.pending
                  ? "กำลังตรวจบัตร"
                  : mutation.error
                    ? "ลองตรวจรหัสเดิมอีกครั้ง"
                    : "ตรวจบัตร"}
              </button>
              <button
                type="button"
                className="button button-outline"
                disabled={mutation.pending}
                onClick={nextTicket}
              >
                ตรวจบัตรถัดไป
              </button>
            </div>
          </form>
          <ErrorNotice error={cameraError} />
          <ErrorNotice error={mutation.error} />
          {result ? (
            <div role="status" className="notice">
              <CheckCircle2 size={24} />
              <div>
                <strong>ตรวจบัตรสำเร็จ · อนุญาตให้เข้างาน 1 คน</strong>
                <p>บันทึกเวลา {dateTime(result.usedAt)}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : !events.error ? (
        <Empty title="ยังไม่มีอีเวนท์ให้ตรวจบัตร">
          สร้างอีเวนท์และเปิดขายก่อน จึงจะตรวจบัตรเข้างานได้
        </Empty>
      ) : null}
    </>
  );
}
