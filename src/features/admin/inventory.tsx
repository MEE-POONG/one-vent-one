"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useResource } from "@/lib/client-api";
import type { EventData, Pool, Unit, Zone } from "@/lib/client-types";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  modeText,
  money,
  PageHeading,
  Status,
} from "@/components/ui";
type AdminEvent = Omit<EventData, "zones" | "units" | "pools"> & {
  zones: (Zone & { pools: Pool[] })[];
  units: (Omit<Unit, "inventory"> & {
    inventory: { status: string; version: number }[];
  })[];
  pools: (Pool & { version: number })[];
};
export function InventoryEditor({ eventId }: { eventId: string }) {
  const resource = useResource<AdminEvent>(`/api/admin/events/${eventId}`);
  const mutation = useMutation();
  const [notice, setNotice] = useState("");
  const [zone, setZone] = useState("");
  const event = resource.data;
  async function submit(path: string, payload: unknown, method = "POST") {
    setNotice("");
    try {
      await mutation.run(
        `/api/admin/events/${eventId}/${path}`,
        payload,
        method,
      );
      await resource.reload();
      setNotice("บันทึกข้อมูลแล้ว");
    } catch {}
  }
  function editPrice(
    kind: "units" | "ticket-types",
    item: { id: string; name: string; priceSatang: number },
  ) {
    if (!event) return;
    const name = window.prompt("ชื่อที่แสดง", item.name);
    if (name === null) return;
    const price = window.prompt(
      "ราคาใหม่ (บาท) ใช้กับรายการจองใหม่",
      String(item.priceSatang / 100),
    );
    if (price === null) return;
    const reason = window.prompt("เหตุผลการแก้ไขราคา / ชื่อ");
    if (reason)
      void submit(
        `${kind}/${item.id}/price`,
        {
          eventVersion: event.version,
          name,
          priceSatang: Math.round(Number(price) * 100),
          reason,
        },
        "PATCH",
      );
  }
  if (resource.loading) return <Loading />;
  return (
    <>
      <PageHeading
        title="โซนและหน่วยขาย"
        description={event?.title}
        action={
          <Link
            href={`/admin/events/${eventId}/layout`}
            className="button button-outline"
          >
            ไปแก้ไขผัง
          </Link>
        }
      />
      <div className="tabs-links">
        <Link href={`/admin/events/${eventId}`}>รายละเอียดงาน</Link>
        <Link href={`/admin/events/${eventId}/inventory`}>โซนและหน่วยขาย</Link>
        <Link href={`/admin/events/${eventId}/layout`}>แก้ไขผัง</Link>
      </div>
      <ErrorNotice
        error={resource.error || mutation.error}
        retry={resource.reload}
      />
      {notice ? (
        <p className="notice success-notice" style={{ marginBottom: 20 }}>
          {notice}
        </p>
      ) : null}
      {event ? (
        <div className="stack">
          <div className="notice">
            โต๊ะเหมาและที่นั่งย่อยของโต๊ะเดียวกันไม่สามารถเปิดขายพร้อมกันได้
            บัตรหลายราคาในโซน GA ใช้ความจุร่วมกัน
          </div>
          {event.status !== "DRAFT" ? (
            <div className="notice">
              เพิ่มโซนและหน่วยขายได้เฉพาะอีเวนท์ฉบับร่าง
              อีเวนท์นี้ยังปรับราคาและเปิดหรือปิดหน่วยที่ไม่มีผู้จองได้ตามสิทธิ์
            </div>
          ) : null}
          <section className="panel">
            <h2>โซนในอีเวนท์</h2>
            {event.zones.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>รหัส / ชื่อ</th>
                      <th>รูปแบบ</th>
                      <th>ความจุร่วม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.zones.map((z) => (
                      <tr key={z.id}>
                        <td>
                          <strong>
                            {z.code} · {z.name}
                          </strong>
                        </td>
                        <td>{modeText(z.sellingMode)}</td>
                        <td>
                          {z.pools
                            ?.map((p) => `${p.name || p.code}: ${p.capacity}`)
                            .join(", ") || "ตามจำนวนหน่วยขาย"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="ยังไม่มีโซน" />
            )}
            <form
              style={{ marginTop: 24 }}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await submit("zones", {
                  code: String(f.get("code")),
                  name: String(f.get("name")),
                  sellingMode: String(f.get("sellingMode")),
                  capacity: Number(f.get("capacity")) || undefined,
                  color: String(f.get("color")),
                });
              }}
            >
              <fieldset
                className="form-grid"
                disabled={event.status !== "DRAFT"}
              >
                <Field label="รหัสโซน">
                  <input
                    name="code"
                    required
                    placeholder="VIP"
                    pattern="[A-Za-z0-9_-]+"
                  />
                </Field>
                <Field label="ชื่อโซน">
                  <input name="name" required />
                </Field>
                <Field label="รูปแบบการขาย">
                  <select name="sellingMode">
                    <option value="TABLE">โต๊ะเหมา</option>
                    <option value="SEAT">ที่นั่ง</option>
                    <option value="GENERAL_ADMISSION">
                      บัตรเข้าชมทั่วไป (GA)
                    </option>
                  </select>
                </Field>
                <Field label="ความจุ GA (คน)">
                  <input
                    name="capacity"
                    type="number"
                    min={1}
                    max={100000}
                    placeholder="ใช้สำหรับโซน GA"
                  />
                </Field>
                <Field label="สีโซน">
                  <input name="color" type="color" defaultValue="#e11d48" />
                </Field>
                <div className="actions">
                  <button className="button" disabled={mutation.pending}>
                    เพิ่มโซน
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
          <section className="panel">
            <h2>โต๊ะและที่นั่ง</h2>
            {event.units?.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>หน่วยขาย</th>
                      <th>สิทธิ์เข้า</th>
                      <th>ราคา</th>
                      <th>สถานะ</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.units.map((unit) => {
                      const inventory = unit.inventory?.[0];
                      return (
                        <tr key={unit.id}>
                          <td>
                            <strong>{unit.code}</strong>
                            <small>{unit.name}</small>
                          </td>
                          <td>{unit.admissionCount} คน</td>
                          <td>
                            <button
                              className="text-link"
                              disabled={
                                mutation.pending ||
                                ["CANCELLED", "COMPLETED"].includes(
                                  event.status,
                                )
                              }
                              onClick={() => editPrice("units", unit)}
                              aria-label={`แก้ราคา ${unit.code}`}
                            >
                              {money(unit.priceSatang)}
                            </button>
                          </td>
                          <td>
                            {event.status === "DRAFT" ? (
                              <button
                                className="button button-subtle button-small"
                                style={{ marginRight: 8 }}
                                disabled={mutation.pending}
                                onClick={() => {
                                  const reason = window.prompt(
                                    unit.active
                                      ? "เหตุผลการนำหน่วยนี้ออกจากการขาย (คงประวัติเดิม)"
                                      : "เหตุผลการนำหน่วยนี้กลับมาขาย",
                                  );
                                  if (reason)
                                    void submit(
                                      `units/${unit.id}/active`,
                                      {
                                        eventVersion: event.version,
                                        active: !unit.active,
                                        reason,
                                      },
                                      "PATCH",
                                    );
                                }}
                              >
                                {unit.active ? "นำออกจากผังขาย" : "นำกลับมาขาย"}
                              </button>
                            ) : null}
                            <Status value={inventory?.status || "BLOCKED"} />
                          </td>
                          <td>
                            {inventory &&
                            ["AVAILABLE", "BLOCKED"].includes(
                              inventory.status,
                            ) ? (
                              <button
                                className="button button-outline button-small"
                                disabled={mutation.pending}
                                onClick={() => {
                                  const reason = window.prompt(
                                    "เหตุผลที่เปลี่ยนสถานะหน่วยขาย",
                                  );
                                  if (reason)
                                    void submit(
                                      `units/${unit.id}`,
                                      {
                                        version: inventory.version,
                                        status:
                                          inventory.status === "AVAILABLE"
                                            ? "BLOCKED"
                                            : "AVAILABLE",
                                        reason,
                                      },
                                      "PATCH",
                                    );
                                }}
                              >
                                {inventory.status === "AVAILABLE"
                                  ? "ปิดหน่วยนี้"
                                  : "เปิดหน่วยนี้"}
                              </button>
                            ) : (
                              <small>มีรายการจอง</small>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            <form
              style={{ marginTop: 24 }}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const z = event.zones.find((z) => z.id === f.get("zoneId"));
                await submit("units", {
                  zoneId: String(f.get("zoneId")),
                  code: String(f.get("code")),
                  name: String(f.get("name")),
                  sellingMode: z?.sellingMode,
                  admissionCount: Number(f.get("admissionCount")),
                  priceSatang: Math.round(Number(f.get("price")) * 100),
                  parentUnitId: String(f.get("parentUnitId")) || undefined,
                });
              }}
            >
              <fieldset
                className="form-grid"
                disabled={event.status !== "DRAFT"}
              >
                <Field label="โซน">
                  <select
                    name="zoneId"
                    required
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                  >
                    <option value="">เลือกโซน</option>
                    {event.zones
                      .filter((z) => z.sellingMode !== "GENERAL_ADMISSION")
                      .map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} ({modeText(z.sellingMode)})
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="รหัสหน่วยขาย">
                  <input
                    name="code"
                    required
                    placeholder="T09 หรือ A13"
                    pattern="[A-Za-z0-9_-]+"
                  />
                </Field>
                <Field label="ชื่อที่แสดง">
                  <input name="name" required />
                </Field>
                <Field label="จำนวนสิทธิ์เข้า">
                  <input
                    name="admissionCount"
                    type="number"
                    required
                    min={1}
                    max={20}
                    defaultValue={1}
                  />
                </Field>
                <Field label="ราคา (บาท)">
                  <input
                    name="price"
                    type="number"
                    required
                    min={0.01}
                    step="0.01"
                  />
                </Field>
                <Field label="โต๊ะแม่ (ถ้าเป็นที่นั่งย่อย)">
                  <select name="parentUnitId">
                    <option value="">ไม่มี</option>
                    {event.units
                      ?.filter((u) => u.sellingMode === "TABLE" && !u.active)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code}
                        </option>
                      ))}
                  </select>
                </Field>
                <div className="full actions">
                  <button
                    className="button"
                    disabled={mutation.pending || !zone}
                  >
                    เพิ่มหน่วยขาย
                  </button>
                  <span className="muted" style={{ fontSize: 12 }}>
                    หลังเพิ่มหน่วยขาย ให้เพิ่มวัตถุและผูกหน่วยนี้ในผัง
                  </span>
                </div>
              </fieldset>
            </form>
          </section>
          <section className="panel">
            <h2>บัตรเข้าชมทั่วไปและโควตาร่วม</h2>
            {event.pools?.map((pool) => (
              <div className="price-row" key={pool.id}>
                <div>
                  <strong>{pool.name || pool.code}</strong>
                  <small>
                    ว่าง {pool.available} · พักสิทธิ์ {pool.held} · รอตรวจ{" "}
                    {pool.reviewReserved} · ขายแล้ว {pool.sold}
                  </small>
                </div>
                <button
                  className="button button-outline button-small"
                  disabled={mutation.pending}
                  onClick={() => {
                    const capacity = window.prompt(
                      "ความจุรวมใหม่",
                      String(pool.capacity),
                    );
                    if (capacity === null) return;
                    const reason = window.prompt("เหตุผลการแก้ไขความจุ");
                    if (reason)
                      void submit(
                        `pools/${pool.id}`,
                        {
                          version: pool.version,
                          capacity: Number(capacity),
                          reason,
                        },
                        "PATCH",
                      );
                  }}
                >
                  ความจุ {pool.capacity}
                </button>
              </div>
            ))}
            {event.ticketTypes?.map((t) => (
              <div className="price-row" key={t.id}>
                <div>
                  <strong>{t.name}</strong>
                  <small>{t.code}</small>
                </div>
                <button
                  className="text-link"
                  disabled={
                    mutation.pending ||
                    ["CANCELLED", "COMPLETED"].includes(event.status)
                  }
                  onClick={() => editPrice("ticket-types", t)}
                  aria-label={`แก้ราคา ${t.name}`}
                >
                  {money(t.priceSatang)}
                </button>
              </div>
            ))}
            <form
              style={{ marginTop: 24 }}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const pool = event.pools.find((p) => p.id === f.get("poolId"));
                await submit("ticket-types", {
                  zoneId: pool?.zoneId,
                  poolId: String(f.get("poolId")),
                  code: String(f.get("code")),
                  name: String(f.get("name")),
                  priceSatang: Math.round(Number(f.get("price")) * 100),
                  saleStartsAt: new Date(
                    `${f.get("saleStartsAt")}+07:00`,
                  ).toISOString(),
                  saleEndsAt: new Date(
                    `${f.get("saleEndsAt")}+07:00`,
                  ).toISOString(),
                });
              }}
            >
              <fieldset
                className="form-grid"
                disabled={event.status !== "DRAFT"}
              >
                <Field label="โควตาที่ใช้ร่วม">
                  <select name="poolId" required>
                    <option value="">เลือกโควตา GA</option>
                    {event.pools?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.code} ({p.capacity} คน)
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="รหัสประเภทบัตร">
                  <input name="code" required pattern="[A-Za-z0-9_-]+" />
                </Field>
                <Field label="ชื่อประเภทบัตร">
                  <input name="name" required placeholder="Early Bird" />
                </Field>
                <Field label="ราคา (บาท)">
                  <input
                    name="price"
                    type="number"
                    required
                    min={0.01}
                    step="0.01"
                  />
                </Field>
                <Field label="เริ่มขาย (เวลาไทย)">
                  <input name="saleStartsAt" type="datetime-local" required />
                </Field>
                <Field label="สิ้นสุดขาย (เวลาไทย)">
                  <input name="saleEndsAt" type="datetime-local" required />
                </Field>
                <div className="full">
                  <button className="button" disabled={mutation.pending}>
                    เพิ่มประเภทบัตร
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
