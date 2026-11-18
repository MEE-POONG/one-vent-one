"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useMutation } from "@/lib/client-api";
import type { EventData, Zone } from "@/lib/client-types";
import { ErrorNotice, Field } from "@/components/ui";

export function ZoneForm({
  event,
  onCreated,
}: {
  event: EventData;
  onCreated: (zone: Zone) => void;
}) {
  const mutation = useMutation();
  const nextDefaultCode = useMemo(() => {
    const existing = new Set((event.zones ?? []).map((z) => z.code.toUpperCase()));
    for (let i = 1; i <= 999; i++) {
      const candidate = `ZONE-${String(i).padStart(2, "0")}`;
      if (!existing.has(candidate)) return candidate;
    }
    return `ZONE-${(event.zones?.length ?? 0) + 1}`;
  }, [event.zones]);

  const [customCode, setCustomCode] = useState("");

  return (
    <form
      className="panel stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (mutation.pending) return;
        const form = e.currentTarget;
        const data = new FormData(form);
        const codeValue = (customCode.trim() || nextDefaultCode).toUpperCase();
        try {
          const zone = await mutation.run<Zone>(
            `/api/admin/events/${event.id}/zones`,
            {
              code: codeValue,
              name: String(data.get("name") ?? "").trim(),
              sellingMode: "GENERAL_ADMISSION",
              color: "#22c55e",
              capacity: Number(data.get("capacity")),
              priceSatang: Math.round(Number(data.get("price")) * 100),
            },
          );
          form.reset();
          setCustomCode("");
          onCreated(zone);
        } catch {}
      }}
    >
      <h3>เพิ่มโซนบัตรเข้างานลงในผัง</h3>
      <p className="muted">
        สำหรับกรณีขายเป็นบัตรเข้างานตามโซน กำหนดชื่อโซน ราคาต่อใบ และจำนวนบัตร แล้วกดวางลงในผังเพื่อให้ลูกค้าคลิกเลือกโซนและระบุจำนวนบัตร (สูงสุด 20 ใบ) ได้เหมือนโต๊ะ
      </p>
      <fieldset
        disabled={event.status !== "DRAFT" || mutation.pending}
        className="form-grid"
      >
        <Field label="ชื่อโซนที่แสดงบนผัง">
          <input
            name="name"
            required
            maxLength={100}
            placeholder="เช่น โซนหน้าเวที / บัตรเข้างานทั่วไป"
          />
        </Field>
        <Field
          label="รหัสโซน (เว้นว่างเพื่อรันอัตโนมัติ)"
          hint={`ค่าอัตโนมัติ: ${nextDefaultCode}`}
        >
          <input
            name="code"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
            maxLength={30}
            pattern="[A-Za-z0-9_-]+"
            placeholder={nextDefaultCode}
          />
        </Field>
        <Field label="ราคาบัตร (บาท / ใบ)">
          <input
            name="price"
            type="number"
            required
            min={1}
            max={1000000}
            step="0.01"
            defaultValue={500}
          />
        </Field>
        <Field label="จำนวนบัตรที่เปิดขายในโซน (ใบ)">
          <input
            name="capacity"
            type="number"
            required
            min={1}
            max={100000}
            defaultValue={100}
          />
        </Field>
        <div className="actions full">
          <button className="button" disabled={mutation.pending}>
            <Plus size={15} />
            สร้างโซนและวางลงในผัง
          </button>
        </div>
      </fieldset>
      {event.status !== "DRAFT" ? (
        <p className="muted">
          เพิ่มโซนใหม่ได้เมื่ออีเวนต์อยู่ในสถานะฉบับร่าง (ปิดการขายแล้วกด “กลับเป็นฉบับร่าง” ในหน้ารายละเอียดงาน)
        </p>
      ) : null}
      <ErrorNotice error={mutation.error} />
    </form>
  );
}
