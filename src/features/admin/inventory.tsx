"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Grid3X3,
  LayoutGrid,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { useMutation, useResource } from "@/lib/client-api";
import type {
  EventData,
  LayoutObject,
  Pool,
  Unit,
  VenueLayout,
  Zone,
} from "@/lib/client-types";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  money,
  PageHeading,
  Status,
} from "@/components/ui";
import {
  computeTableGridPositions,
  formatTableCode,
  generateTableBatchSpecs,
  getLastTableDefaults,
  getNextTableSequence,
  naturalSortByCode,
  snap10,
} from "./table-grid-helpers";
import { WordGridPicker } from "./word-grid-picker";

type AdminEvent = Omit<EventData, "zones" | "units" | "pools"> & {
  zones: (Zone & { pools: Pool[] })[];
  units: (Omit<Unit, "inventory"> & {
    inventory: { status: string; version: number }[];
  })[];
  pools: (Pool & { version: number })[];
  layoutTemplate?: VenueLayout;
};

export function InventoryEditor({ eventId }: { eventId: string }) {
  const resource = useResource<AdminEvent>(`/api/admin/events/${eventId}`);
  const mutation = useMutation();
  const [notice, setNotice] = useState("");

  const event = resource.data;
  const isDraft = event?.status === "DRAFT";

  const sortedUnits = useMemo(
    () => naturalSortByCode(event?.units ?? []),
    [event?.units],
  );

  const defaults = useMemo(
    () => getLastTableDefaults(event?.units ?? []),
    [event?.units],
  );

  // Add mode: "batch" (Word-style grid / multi-table auto-increment) or "single" (1-by-1 with auto-increment)
  const [addMode, setAddMode] = useState<"batch" | "single">("batch");
  const [prefixOverride, setPrefixOverride] = useState<string | null>(null);
  const [customStart, setCustomStart] = useState("");
  const [gridRows, setGridRows] = useState(4);
  const [gridCols, setGridCols] = useState(6);
  const [seatsOverride, setSeatsOverride] = useState<string | null>(null);
  const [priceOverride, setPriceOverride] = useState<string | null>(null);
  const [autoPlaceInLayout, setAutoPlaceInLayout] = useState(true);

  // Single-unit form optional overrides
  const [singleCodeOverride, setSingleCodeOverride] = useState<string | null>(
    null,
  );
  const [singleNameOverride, setSingleNameOverride] = useState<string | null>(
    null,
  );

  // Bulk price/seat editor state (by all tables or code range)
  const [bulkFromCode, setBulkFromCode] = useState("");
  const [bulkToCode, setBulkToCode] = useState("");
  const [bulkSeats, setBulkSeats] = useState("4");
  const [bulkPrice, setBulkPrice] = useState("2400");
  const [showBulkPrice, setShowBulkPrice] = useState(false);

  const prefix = prefixOverride ?? (defaults.prefix || "T");
  const seatsInput = seatsOverride ?? String(defaults.seats || 4);
  const priceInput = priceOverride ?? String(defaults.priceBaht || 2400);

  const existingCodes = useMemo(
    () => new Set((event?.units ?? []).map((u) => u.code)),
    [event?.units],
  );

  const nextAutoNum = useMemo(
    () => getNextTableSequence(existingCodes, prefix),
    [existingCodes, prefix],
  );

  const defaultSingleCode = formatTableCode(prefix, nextAutoNum, 2);
  const singleCode = singleCodeOverride ?? defaultSingleCode;
  const singleName = singleNameOverride ?? `โต๊ะ ${singleCode}`;

  const effectiveStartNum =
    customStart.trim() !== "" && Number(customStart) >= 1
      ? Math.floor(Number(customStart))
      : nextAutoNum;

  const batchPreviewSpecs = useMemo(
    () =>
      generateTableBatchSpecs({
        prefix,
        startNumber: effectiveStartNum,
        count: gridRows * gridCols,
        seats: Number(seatsInput) || 4,
        priceBaht: Number(priceInput) || 2400,
        existingCodes,
      }),
    [
      prefix,
      effectiveStartNum,
      gridRows,
      gridCols,
      seatsInput,
      priceInput,
      existingCodes,
    ],
  );

  // Group existing tables into price/seat sets for summary overview
  const priceTiersSummary = useMemo(() => {
    const groups = new Map<
      string,
      { seats: number; priceSatang: number; codes: string[] }
    >();
    for (const u of sortedUnits) {
      const key = `${u.admissionCount}-${u.priceSatang}`;
      const g = groups.get(key) ?? {
        seats: u.admissionCount,
        priceSatang: u.priceSatang,
        codes: [],
      };
      g.codes.push(u.code);
      groups.set(key, g);
    }
    return Array.from(groups.values());
  }, [sortedUnits]);

  async function appendUnitsToDraftLayout(createdUnits: Unit[], cols: number) {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/layout`);
      const body = (await res.json()) as { ok: boolean; data?: VenueLayout };
      const currentLayout = body.data ?? event?.layoutTemplate;
      if (!currentLayout) return false;

      const existingObjs: LayoutObject[] =
        currentLayout.geometry?.objects ?? [];
      const hasStage = existingObjs.some(
        (o: LayoutObject) => o.type === "stage",
      );
      const hasEntrance = existingObjs.some(
        (o: LayoutObject) => o.type === "entrance",
      );

      const baseObjects: LayoutObject[] = [...existingObjs];
      if (!hasStage) {
        baseObjects.push({
          id: crypto.randomUUID(),
          code: "STAGE",
          name: "STAGE",
          type: "stage",
          shape: "rect",
          x: snap10((currentLayout.width - 420) / 2),
          y: 30,
          width: 420,
          height: 70,
          rotation: 0,
        });
      }

      const placement = computeTableGridPositions({
        totalCount: createdUnits.length,
        cols,
        canvasWidth: currentLayout.width,
        canvasHeight: currentLayout.height,
        existingObjects: baseObjects,
        replaceExistingTables: false,
      });

      const tableObjects: LayoutObject[] = createdUnits.map((u, idx) => {
        const pos = placement.positions[idx];
        return {
          id: crypto.randomUUID(),
          code: u.code,
          name: u.name,
          type: "table",
          shape: "rect",
          x: pos.x,
          y: pos.y,
          width: pos.width,
          height: pos.height,
          rotation: 0,
          zoneId: u.zoneId,
          unitId: u.id,
        };
      });

      if (!hasEntrance) {
        baseObjects.push({
          id: crypto.randomUUID(),
          code: "ENTRANCE",
          name: "ทางเข้า (Entrance)",
          type: "entrance",
          shape: "rect",
          x: snap10(placement.requiredWidth - 200),
          y: snap10(placement.requiredHeight - 70),
          width: 150,
          height: 50,
          rotation: 0,
        });
      }

      await mutation.run(
        `/api/admin/events/${eventId}/layout`,
        {
          version: currentLayout.version ?? currentLayout.revision ?? 0,
          width: placement.requiredWidth,
          height: placement.requiredHeight,
          geometry: { objects: [...baseObjects, ...tableObjects] },
        },
        "PUT",
      );
      return true;
    } catch {
      return false;
    }
  }

  async function submit(path: string, payload: unknown, method = "POST") {
    setNotice("");
    try {
      const result = await mutation.run<{ layoutObjectsRemoved?: number }>(
        `/api/admin/events/${eventId}/${path}`,
        payload,
        method,
      );
      await resource.reload();
      setNotice(
        method === "DELETE"
          ? `ลบแล้ว${result?.layoutObjectsRemoved ? ` และนำวัตถุ ${result.layoutObjectsRemoved} ชิ้นออกจากผังร่าง (อย่าลืมเผยแพร่ผังใหม่)` : ""}`
          : "บันทึกข้อมูลแล้ว",
      );
      return true;
    } catch {
      return false;
    }
  }

  async function submitBatchTables(rows: number, cols: number) {
    if (!event || mutation.pending) return;
    setNotice("");
    const specs = generateTableBatchSpecs({
      prefix,
      startNumber: effectiveStartNum,
      count: rows * cols,
      seats: Number(seatsInput) || 4,
      priceBaht: Number(priceInput) || 2400,
      existingCodes,
    });
    if (!specs.length) return;
    try {
      const res = await mutation.run<{
        units: Unit[];
        eventVersion: number;
      }>(
        `/api/admin/events/${eventId}/units/batch`,
        {
          sellingMode: "TABLE",
          units: specs,
        },
        "POST",
      );
      let placed = false;
      if (autoPlaceInLayout && res.units.length > 0) {
        placed = await appendUnitsToDraftLayout(res.units, cols);
      }
      setCustomStart("");
      await resource.reload();
      const firstCode = res.units[0]?.code;
      const lastCode = res.units[res.units.length - 1]?.code;
      setNotice(
        `สร้างชุดโต๊ะ ${res.units.length} โต๊ะ (${firstCode} – ${lastCode} · ราคา ฿${Number(priceInput || 0).toLocaleString("th-TH")}/โต๊ะ)${
          placed
            ? ` พร้อมวางเรียงในผัง (${rows} แถว × ${cols} โต๊ะ/แถว) เรียบร้อยแล้ว`
            : " เรียบร้อยแล้ว"
        }`,
      );
    } catch {}
  }

  function remove(path: string, label: string) {
    if (!event) return;
    if (!window.confirm(`ลบ ${label} ถาวร?`)) return;
    void submit(path, { eventVersion: event.version }, "DELETE");
  }

  function editPrice(item: {
    id: string;
    name: string;
    priceSatang: number;
    admissionCount?: number;
  }) {
    if (!event) return;
    const name = window.prompt("ชื่อที่แสดง", item.name);
    if (name === null) return;
    const seats = window.prompt(
      "จำนวนที่นั่งในโต๊ะ (คน)",
      String(item.admissionCount ?? 4),
    );
    if (seats === null) return;
    const price = window.prompt(
      "ราคาใหม่ (บาท) ใช้กับรายการจองใหม่",
      String(item.priceSatang / 100),
    );
    if (price === null) return;
    void submit(
      `units/${item.id}/price`,
      {
        eventVersion: event.version,
        name,
        priceSatang: Math.round(Number(price) * 100),
        admissionCount: Math.max(1, Math.min(20, Number(seats) || 4)),
        reason: "ปรับข้อมูลที่นั่งและราคาโต๊ะ",
      },
      "PATCH",
    );
  }

  if (resource.loading) return <Loading />;
  return (
    <>
      <PageHeading
        title="จัดการโต๊ะและราคา"
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
        <Link href={`/admin/events/${eventId}/inventory`}>
          จัดการโต๊ะและราคา
        </Link>
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
          {event.status !== "DRAFT" ? (
            <div className="notice">
              เพิ่ม/ลบโต๊ะได้เฉพาะอีเวนท์ฉบับร่าง อีเวนท์นี้ยังปรับราคาและจำนวนที่นั่งของชุดโต๊ะ
              หรือเปิด/ปิดโต๊ะที่ไม่มีผู้จองได้ หากต้องการเพิ่มจำนวนโต๊ะใหม่
              ให้ปิดการขายแล้วกด “กลับเป็นฉบับร่าง” ที่หน้ารายละเอียดงาน
            </div>
          ) : null}

          <section className="panel">
            <div
              className="between"
              style={{ marginBottom: 18, flexWrap: "wrap", gap: 12 }}
            >
              <div>
                <h2 style={{ margin: 0 }}>
                  ชุดโต๊ะและราคาขาย ({sortedUnits.length} โต๊ะ)
                </h2>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  ราคาขายและจำนวนที่นั่งยึดตามชุดโต๊ะที่สร้าง
                  สามารถสร้างหลายชุดราคาต่อเนื่องกันได้ทันที (Auto-Increment)
                </p>
              </div>
              <div className="actions">
                {sortedUnits.length > 0 ? (
                  <button
                    type="button"
                    className={`button button-small ${showBulkPrice ? "" : "button-outline"}`}
                    onClick={() => setShowBulkPrice((v) => !v)}
                  >
                    <Sparkles size={14} />
                    ปรับราคา/ที่นั่งแบบชุดโต๊ะ
                  </button>
                ) : null}
                <Link
                  href={`/admin/events/${eventId}/layout`}
                  className="button button-small"
                >
                  <LayoutGrid size={14} />
                  ไปหน้าจัดผังโต๊ะ
                </Link>
              </div>
            </div>

            {priceTiersSummary.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {priceTiersSummary.map((tier) => (
                  <div
                    key={`${tier.seats}-${tier.priceSatang}`}
                    style={{
                      padding: "12px 15px",
                      borderRadius: 10,
                      background: "#14141a",
                      border: "1px solid #32323d",
                    }}
                  >
                    <div className="between">
                      <strong>{money(tier.priceSatang)} / โต๊ะ</strong>
                      <span className="word-grid-badge">
                        {tier.codes.length} โต๊ะ
                      </span>
                    </div>
                    <small className="muted" style={{ display: "block", marginTop: 4 }}>
                      {tier.seats} ที่นั่ง/โต๊ะ · รหัส {tier.codes[0]}
                      {tier.codes.length > 1
                        ? ` – ${tier.codes[tier.codes.length - 1]}`
                        : ""}
                    </small>
                  </div>
                ))}
              </div>
            ) : null}

            {showBulkPrice ? (
              <div className="editor-popover-panel" style={{ marginBottom: 22 }}>
                <h3 style={{ fontSize: 15, marginBottom: 12 }}>
                  ปรับจำนวนที่นั่งและราคาขายแบบชุดโต๊ะ
                </h3>
                <div className="form-grid" style={{ alignItems: "end" }}>
                  <Field
                    label="ตั้งแต่โต๊ะรหัส (เว้นว่าง = โต๊ะแรก)"
                    hint="เช่น T01"
                  >
                    <select
                      value={bulkFromCode}
                      onChange={(e) => setBulkFromCode(e.target.value)}
                    >
                      <option value="">ตั้งแต่โต๊ะแรก ({sortedUnits[0]?.code})</option>
                      {sortedUnits.map((u) => (
                        <option key={u.id} value={u.code}>
                          {u.code}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="ถึงโต๊ะรหัส (เว้นว่าง = โต๊ะสุดท้าย)"
                    hint="เช่น T12"
                  >
                    <select
                      value={bulkToCode}
                      onChange={(e) => setBulkToCode(e.target.value)}
                    >
                      <option value="">
                        ถึงโต๊ะสุดท้าย ({sortedUnits[sortedUnits.length - 1]?.code})
                      </option>
                      {sortedUnits.map((u) => (
                        <option key={u.id} value={u.code}>
                          {u.code}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="จำนวนที่นั่งใหม่ (คน/โต๊ะ)">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={bulkSeats}
                      onChange={(e) => setBulkSeats(e.target.value)}
                    />
                  </Field>
                  <Field label="ราคาขายใหม่ (บาท/โต๊ะ)">
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      value={bulkPrice}
                      onChange={(e) => setBulkPrice(e.target.value)}
                    />
                  </Field>
                  <div className="actions full">
                    <button
                      type="button"
                      className="button"
                      disabled={mutation.pending}
                      onClick={async () => {
                        const startIdx = bulkFromCode
                          ? sortedUnits.findIndex((u) => u.code === bulkFromCode)
                          : 0;
                        const endIdx = bulkToCode
                          ? sortedUnits.findIndex((u) => u.code === bulkToCode)
                          : sortedUnits.length - 1;
                        const lo = Math.max(0, Math.min(startIdx, endIdx));
                        const hi = Math.min(
                          sortedUnits.length - 1,
                          Math.max(startIdx, endIdx),
                        );
                        const targetIds = sortedUnits
                          .slice(lo, hi + 1)
                          .map((u) => u.id);
                        const seatsNum = Math.max(
                          1,
                          Math.min(20, Number(bulkSeats) || 4),
                        );
                        const priceSatang = Math.max(
                          100,
                          Math.round((Number(bulkPrice) || 2400) * 100),
                        );
                        await submit(
                          "units/batch",
                          {
                            unitIds: targetIds,
                            admissionCount: seatsNum,
                            priceSatang,
                            reason: "ปรับจำนวนที่นั่งและราคาชุดโต๊ะ",
                            eventVersion: event.version,
                          },
                          "PATCH",
                        );
                        setShowBulkPrice(false);
                      }}
                    >
                      <Save size={15} />
                      บันทึกการปรับราคาชุดโต๊ะ
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {isDraft ? (
              <div className="editor-popover-panel" style={{ marginBottom: 24 }}>
                <div
                  className="tabs"
                  role="tablist"
                  style={{ marginBottom: 16 }}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={addMode === "batch"}
                    onClick={() => setAddMode("batch")}
                  >
                    <Grid3X3
                      size={14}
                      style={{ verticalAlign: "middle", marginRight: 6 }}
                    />
                    เพิ่มชุดโต๊ะแบบตาราง (กำหนดแถว × โต๊ะ)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={addMode === "single"}
                    onClick={() => setAddMode("single")}
                  >
                    <Plus
                      size={14}
                      style={{ verticalAlign: "middle", marginRight: 6 }}
                    />
                    เพิ่มทีละโต๊ะ (รันเลขถัดไปอัตโนมัติ:{" "}
                    {formatTableCode(prefix, nextAutoNum)})
                  </button>
                </div>

                {addMode === "batch" ? (
                  <div className="editor-grid-builder-layout">
                    <div className="stack-sm">
                      <div className="form-grid">
                        <Field
                          label="คำนำหน้ารหัส (Prefix)"
                          hint="เช่น T, VIP, A"
                        >
                          <input
                            value={prefix}
                            onChange={(e) => setPrefixOverride(e.target.value)}
                            placeholder="T"
                          />
                        </Field>
                        <Field
                          label="เริ่มจากเลข (Auto-Increment)"
                          hint={`ว่างไว้ = ต่อจากเดิมอัตโนมัติ (${formatTableCode(prefix, nextAutoNum)})`}
                        >
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              type="number"
                              min={1}
                              max={999}
                              value={customStart}
                              placeholder={String(nextAutoNum)}
                              onChange={(e) => setCustomStart(e.target.value)}
                            />
                            {customStart ? (
                              <button
                                type="button"
                                className="button button-subtle button-small"
                                onClick={() => setCustomStart("")}
                                title="รีเซ็ตเป็นเลขต่อจากเดิมอัตโนมัติ"
                              >
                                <RotateCcw size={13} />
                              </button>
                            ) : null}
                          </div>
                        </Field>
                        <Field label="จำนวนที่นั่งต่อโต๊ะ (คน)">
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={seatsInput}
                            onChange={(e) => setSeatsOverride(e.target.value)}
                          />
                        </Field>
                        <Field label="ราคาขายของชุดโต๊ะนี้ (บาท/โต๊ะ)">
                          <input
                            type="number"
                            min={1}
                            step="0.01"
                            value={priceInput}
                            onChange={(e) => setPriceOverride(e.target.value)}
                          />
                        </Field>
                      </div>
                      <label
                        className="check-label"
                        style={{ margin: "10px 0 6px" }}
                      >
                        <input
                          type="checkbox"
                          checked={autoPlaceInLayout}
                          onChange={(e) =>
                            setAutoPlaceInLayout(e.target.checked)
                          }
                        />
                        <span>
                          วางและจัดเรียงโต๊ะชุดนี้ลงในผังอัตโนมัติ ({gridRows}{" "}
                          แถว × {gridCols} โต๊ะ/แถว)
                        </span>
                      </label>
                      <div className="actions">
                        <button
                          type="button"
                          className="button"
                          disabled={mutation.pending}
                          onClick={() => submitBatchTables(gridRows, gridCols)}
                        >
                          <Grid3X3 size={15} />
                          {mutation.pending
                            ? "กำลังสร้างชุดโต๊ะ..."
                            : `เพิ่มชุดโต๊ะ ${gridRows}×${gridCols} (${gridRows * gridCols} โต๊ะ: ${batchPreviewSpecs[0]?.code ?? ""} – ${batchPreviewSpecs[batchPreviewSpecs.length - 1]?.code ?? ""})`}
                        </button>
                      </div>
                    </div>

                    <WordGridPicker
                      rows={gridRows}
                      cols={gridCols}
                      defaultInstant={false}
                      disabled={mutation.pending}
                      codePreview={
                        batchPreviewSpecs.length
                          ? `รหัสที่จะสร้าง: ${batchPreviewSpecs[0].code} – ${batchPreviewSpecs[batchPreviewSpecs.length - 1].code} (${seatsInput} ที่ · ฿${Number(priceInput || 0).toLocaleString("th-TH")}/โต๊ะ)`
                          : undefined
                      }
                      onSelect={(r, c) => {
                        setGridRows(r);
                        setGridCols(c);
                      }}
                      onInstantCommit={(r, c) => {
                        setGridRows(r);
                        setGridCols(c);
                        void submitBatchTables(r, c);
                      }}
                    />
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (mutation.pending) return;
                      try {
                        const res = await mutation.run<{
                          units: Unit[];
                          eventVersion: number;
                        }>(
                          `/api/admin/events/${eventId}/units/batch`,
                          {
                            sellingMode: "TABLE",
                            units: [
                              {
                                code: singleCode.trim(),
                                name:
                                  singleName.trim() ||
                                  `โต๊ะ ${singleCode.trim()}`,
                                admissionCount: Math.max(
                                  1,
                                  Math.min(20, Number(seatsInput) || 4),
                                ),
                                priceSatang: Math.max(
                                  100,
                                  Math.round((Number(priceInput) || 2400) * 100),
                                ),
                              },
                            ],
                          },
                          "POST",
                        );
                        if (autoPlaceInLayout && res.units.length > 0) {
                          await appendUnitsToDraftLayout(res.units, 6);
                        }
                        setSingleCodeOverride(null);
                        setSingleNameOverride(null);
                        await resource.reload();
                        setNotice(
                          `เพิ่มโต๊ะ ${res.units[0]?.code} เรียบร้อยแล้ว — รหัสโต๊ะถัดไปรันให้อัตโนมัติ`,
                        );
                      } catch {}
                    }}
                  >
                    <div className="form-grid">
                      <Field
                        label="รหัสโต๊ะ (Auto-Increment)"
                        hint="รันเลขต่อจากโต๊ะล่าสุดให้อัตโนมัติ"
                      >
                        <input
                          value={singleCode}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSingleCodeOverride(val);
                            setSingleNameOverride(`โต๊ะ ${val}`);
                          }}
                          required
                          placeholder="T01"
                          pattern="[A-Za-z0-9_-]+"
                        />
                      </Field>
                      <Field label="ชื่อที่แสดง">
                        <input
                          value={singleName}
                          onChange={(e) =>
                            setSingleNameOverride(e.target.value)
                          }
                          required
                        />
                      </Field>
                      <Field label="จำนวนที่นั่งในโต๊ะ (คน)">
                        <input
                          type="number"
                          required
                          min={1}
                          max={20}
                          value={seatsInput}
                          onChange={(e) => setSeatsOverride(e.target.value)}
                        />
                      </Field>
                      <Field label="ราคาขาย (บาท/โต๊ะ)">
                        <input
                          type="number"
                          required
                          min={0.01}
                          step="0.01"
                          value={priceInput}
                          onChange={(e) => setPriceOverride(e.target.value)}
                        />
                      </Field>
                      <div className="full actions">
                        <button className="button" disabled={mutation.pending}>
                          <Plus size={15} />
                          เพิ่มโต๊ะ {singleCode} (พร้อมรันเลขถัดไปอัตโนมัติ)
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            ) : null}

            {sortedUnits.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>รหัสโต๊ะ</th>
                      <th>ที่นั่งในโต๊ะ</th>
                      <th>ราคาขาย</th>
                      <th>สถานะ</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUnits.map((unit) => {
                      const inventory = unit.inventory?.[0];
                      return (
                        <tr key={unit.id}>
                          <td>
                            <strong>{unit.code}</strong>
                            <small>{unit.name}</small>
                          </td>
                          <td>{unit.admissionCount} ที่นั่ง</td>
                          <td>
                            <button
                              className="text-link"
                              disabled={
                                mutation.pending ||
                                ["CANCELLED", "COMPLETED"].includes(
                                  event.status,
                                )
                              }
                              onClick={() => editPrice(unit)}
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
                                      ? "เหตุผลการนำโต๊ะนี้ออกจากการขาย (คงประวัติเดิม)"
                                      : "เหตุผลการนำโต๊ะนี้กลับมาขาย",
                                    "ปรับสถานะการขายโต๊ะ",
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
                                    "เหตุผลที่เปลี่ยนสถานะโต๊ะ",
                                    "ปรับสถานะโต๊ะ",
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
                                  ? "ปิดโต๊ะนี้"
                                  : "เปิดโต๊ะนี้"}
                              </button>
                            ) : (
                              <small>มีรายการจอง</small>
                            )}
                            {isDraft ? (
                              <button
                                className="button button-danger button-small"
                                style={{ marginLeft: 8 }}
                                disabled={mutation.pending}
                                onClick={() =>
                                  remove(
                                    `units/${unit.id}`,
                                    `โต๊ะ ${unit.code}`,
                                  )
                                }
                              >
                                ลบ
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="ยังไม่มีโต๊ะในอีเวนท์นี้ — เลือกตารางแถว × โต๊ะด้านบนเพื่อสร้างชุดโต๊ะได้ทันที" />
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
