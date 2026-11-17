"use client";
import { useState } from "react";
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
  const [mode, setMode] = useState("GENERAL_ADMISSION");
  return (
    <form
      className="panel stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (mutation.pending) return;
        const form = e.currentTarget;
        const data = new FormData(form);
        try {
          const zone = await mutation.run<Zone>(
            `/api/admin/events/${event.id}/zones`,
            {
              code: data.get("code"),
              name: data.get("name"),
              sellingMode: mode,
              color: data.get("color"),
              ...(mode === "GENERAL_ADMISSION"
                ? {
                    capacity: Number(data.get("capacity")),
                    priceSatang: Math.round(Number(data.get("price")) * 100),
                  }
                : {}),
            },
          );
          form.reset();
          onCreated(zone);
        } catch {}
      }}
    >
      <h3>เพิ่มโซนในผัง</h3>
      <p className="muted">
        บัตรยืนขายตามจำนวนคนในโซน ไม่ระบุที่นั่ง
        สร้างโควตาและราคาพร้อมกันเมื่อบันทึก
      </p>
      <fieldset
        disabled={event.status !== "DRAFT" || mutation.pending}
        className="form-grid"
      >
        <Field label="รูปแบบการจำหน่าย">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="GENERAL_ADMISSION">บัตรยืน / เข้าชมตามโซน</option>
            <option value="TABLE">โต๊ะ</option>
            <option value="SEAT">ที่นั่ง</option>
          </select>
        </Field>
        <Field label="รหัสโซน">
          <input
            name="code"
            required
            maxLength={30}
            pattern="[A-Za-z0-9_-]+"
            placeholder="เช่น STANDING-A"
          />
        </Field>
        <Field label="ชื่อโซน">
          <input
            name="name"
            required
            maxLength={100}
            placeholder="เช่น โซนยืนหน้าเวที"
          />
        </Field>
        <Field label="สีโซน">
          <input name="color" type="color" defaultValue="#E11D48" />
        </Field>
        {mode === "GENERAL_ADMISSION" ? (
          <>
            <Field label="จำนวนบัตรในโซน (คน)">
              <input
                name="capacity"
                type="number"
                required
                min={1}
                max={100000}
                defaultValue={100}
              />
            </Field>
            <Field label="ราคาต่อคน (บาท)">
              <input
                name="price"
                type="number"
                required
                min={0.01}
                max={1000000}
                step="0.01"
                defaultValue={500}
              />
            </Field>
          </>
        ) : null}
        <button className="button" disabled={mutation.pending}>
          สร้างโซนและวางในผัง
        </button>
      </fieldset>
      {event.status !== "DRAFT" ? (
        <p className="muted">เพิ่มโซนได้เฉพาะอีเวนต์ฉบับร่าง</p>
      ) : null}
      <ErrorNotice error={mutation.error} />
    </form>
  );
}
