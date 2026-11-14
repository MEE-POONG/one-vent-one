"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, KeyRound, ScanLine, Users } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import { api, useMutation, useResource } from "@/lib/client-api";
import type {
  EventData,
  PageData,
  VerifiedTicketInspection,
} from "@/lib/client-types";
import {
  dateTime,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  PageHeading,
  Pagination,
} from "@/components/ui";
import { VerifiedTicketFlipCard } from "@/features/tickets/verified-ticket-card";

type CheckInResult = {
  ticketId: string;
  ticketCode: string;
  itemLabel: string;
  status: string;
  checkedInCount: number;
  totalAdmissions: number;
  remainingAdmissions: number;
  usedAt: string;
};

function parseScannedTokenOrCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(trimmed)) return trimmed;
  const urlMatch = trimmed.match(
    /\/tickets\/verify\/([A-Za-z0-9_-]{43}|[A-Za-z]{2}\d{6})(?:[/?#]|$)/i,
  );
  if (urlMatch) {
    const val = urlMatch[1];
    return val.length === 8 ? val.toUpperCase() : val;
  }
  const compact = trimmed.replace(/[\s-]+/g, "").toUpperCase();
  if (/^[A-Z]{2}\d{6}$/.test(compact)) return compact;
  return null;
}

export function CheckInDesk() {
  const [page, setPage] = useState(1);
  const events = useResource<PageData<EventData>>(
    `/api/admin/events?page=${page}&pageSize=50`,
  );
  const mutation = useMutation();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [token, setToken] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [inspected, setInspected] = useState<VerifiedTicketInspection | null>(
    null,
  );
  const [cameraError, setCameraError] = useState<Error | null>(null);
  const [cameraState, setCameraState] = useState<"off" | "starting" | "on">(
    "off",
  );
  const scanner = useRef<Html5Qrcode | null>(null);
  const scanningPaused = useRef(false);
  const busy = useRef(false);
  const disposed = useRef(false);
  const cameraId = `qr-camera-${useId().replace(/:/g, "")}`;

  const defaultEventId = useMemo(() => {
    const items = events.data?.items ?? [];
    const pub = items.find((e) => e.status === "PUBLISHED");
    return pub?.id || items[0]?.id || "";
  }, [events.data]);

  const eventId = selectedEventId || defaultEventId;

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

  async function submit(raw: string, targetEvent = eventId) {
    if (busy.current) return;
    const parsedToken = parseScannedTokenOrCode(raw);
    if (!targetEvent || !parsedToken) {
      setCameraError(
        new Error(
          "กรุณาเลือกอีเวนท์ และกรอกรหัสบัตร 8 หลัก (เช่น MK001482) หรือสแกน QR Code จากหลังบัตร",
        ),
      );
      return;
    }
    busy.current = true;
    scanningPaused.current = true;
    setResult(null);
    setCameraError(null);
    try {
      const checked = await mutation.run<CheckInResult>("/api/check-in", {
        eventId: targetEvent,
        token: parsedToken,
      });
      setResult(checked);
    } catch {
    } finally {
      try {
        const detail = await api<VerifiedTicketInspection>(
          `/api/tickets/verify/${encodeURIComponent(parsedToken)}`,
        );
        setInspected(detail);
      } catch {}
      busy.current = false;
      window.setTimeout(() => {
        scanningPaused.current = false;
      }, 1200);
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
          void submit(decoded, eventId);
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
            "เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง หรือกรอกรหัสบัตร 8 หลักด้านล่างแทน",
          ),
        );
      }
    }
  }

  function nextTicket() {
    setToken("");
    setResult(null);
    setInspected(null);
    setCameraError(null);
    mutation.setError(null);
    scanningPaused.current = false;
  }

  const parsedInput = parseScannedTokenOrCode(token);

  return (
    <>
      <PageHeading
        title="ตรวจบัตรเข้างาน (สแกน QR / กรอกรหัสบัตร 8 หลัก)"
        description="1 โต๊ะใช้บัตรใบเดียวร่วมกันได้ตามจำนวนที่นั่งในโต๊ะ สแกน QR Code หรือกรอกรหัส 8 หลักจากหลังบัตรเพื่อยืนยันเข้างานทีละ 1 ท่านจนครบจำนวนที่นั่งในโต๊ะ"
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
                setSelectedEventId(e.target.value);
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
              <strong>วิธีตรวจเข้างาน:</strong> เลือกสแกน QR Code จากหลังบัตร
              หรือกรอก<strong>รหัสบัตร 8 หลัก</strong> (เช่น <code>MK001482</code>{" "}
              = 2 ตัวอักษร + เลขโต๊ะ 3 หลัก + เลขสุ่ม 3 หลัก)
              การกดยืนยัน 1 ครั้งจะนับผู้เข้างาน 1 ท่าน จนครบจำนวนที่นั่งในโต๊ะ
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
              type="button"
              className="button button-outline"
              disabled={!eventId || cameraState === "starting"}
              onClick={() => {
                if (cameraState === "on") void stopCamera();
                else void startCamera();
              }}
            >
              <Camera size={18} />
              {cameraState === "starting"
                ? "กำลังเปิดกล้อง..."
                : cameraState === "on"
                  ? "ปิดกล้องสแกน"
                  : "เปิดกล้องสแกน QR Code"}
            </button>
          </div>
          <form
            className="stack-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(token, eventId);
            }}
          >
            <Field
              label="รหัสบัตร 8 หลัก หรือ QR Code"
              hint="รูปแบบรหัส 8 หลัก: ตัวอักษร 2 ตัว + เลขโต๊ะ 3 หลัก + เลขสุ่ม 3 หลัก (เช่น MK001482)"
            >
              <input
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
                placeholder="กรอกรหัสบัตร 8 หลัก เช่น MK001482 หรือสแกน QR Code"
                style={{
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 16,
                  letterSpacing: "0.06em",
                }}
              />
            </Field>
            <div className="actions">
              <button
                type="submit"
                className="button"
                disabled={!eventId || !parsedInput || mutation.pending}
              >
                <KeyRound size={16} />
                {mutation.pending
                  ? "กำลังยืนยันเข้างาน..."
                  : result && result.remainingAdmissions > 0
                    ? `ยืนยันเข้างานซ้ำรหัสเดิม (+1 ท่าน · ครั้งที่ ${result.checkedInCount + 1}/${result.totalAdmissions})`
                    : "ยืนยันให้เข้างาน (+1 ท่าน)"}
              </button>
              <button
                type="button"
                className="button button-outline"
                disabled={mutation.pending}
                onClick={nextTicket}
              >
                ล้างข้อมูล / ตรวจโต๊ะถัดไป
              </button>
            </div>
          </form>
          <ErrorNotice error={cameraError} />
          <ErrorNotice error={mutation.error} />
          {result ? (
            <div role="status" className="checkin-result">
              <div className="between" style={{ flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle2 size={22} />
                    <span>
                      ยืนยันเข้างานสำเร็จ · {result.itemLabel} (รหัส {result.ticketCode})
                    </span>
                  </h3>
                  <p style={{ marginTop: 4 }}>
                    <Users
                      size={15}
                      style={{ display: "inline", marginRight: 6 }}
                    />
                    เช็กอินเข้างานแล้ว{" "}
                    <strong>
                      {result.checkedInCount} / {result.totalAdmissions} ที่นั่ง
                    </strong>{" "}
                    {result.remainingAdmissions > 0
                      ? `(ยังเข้างานได้อีก ${result.remainingAdmissions} ท่าน)`
                      : "(ครบทุกที่นั่งในโต๊ะแล้ว)"}{" "}
                    · เวลา {dateTime(result.usedAt)}
                  </p>
                </div>
                {result.remainingAdmissions > 0 ? (
                  <button
                    type="button"
                    className="button"
                    disabled={mutation.pending}
                    onClick={() => void submit(result.ticketCode, eventId)}
                  >
                    <CheckCircle2 size={16} />
                    <span>
                      ยืนยันเพิ่มอีก 1 ท่าน ({result.checkedInCount + 1}/
                      {result.totalAdmissions})
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {inspected ? (
            <div style={{ marginTop: 18 }}>
              <VerifiedTicketFlipCard
                data={inspected}
                defaultFlipped={true}
                onCheckInSuccess={() => {
                  if (parsedInput) {
                    void api<VerifiedTicketInspection>(
                      `/api/tickets/verify/${encodeURIComponent(parsedInput)}`,
                    ).then(setInspected);
                  }
                }}
              />
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
