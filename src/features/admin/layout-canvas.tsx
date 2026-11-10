"use client";
import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Ellipse,
  Text,
  Group,
  Transformer,
  Line,
} from "react-konva";
import Konva from "konva";
import { Copy, Eye, Minus, Plus, Save, Trash2, Upload } from "lucide-react";
import { useMutation } from "@/lib/client-api";
import type {
  EventData,
  LayoutObject,
  Unit,
  VenueLayout,
} from "@/lib/client-types";
import { ErrorNotice, Field } from "@/components/ui";
import { VenueView } from "@/components/venue-view";
const typeLabels: Record<LayoutObject["type"], string> = {
  zone: "โซน",
  stage: "เวที",
  entrance: "ทางเข้า",
  aisle: "ทางเดิน",
  service: "จุดบริการ",
  label: "ป้าย",
  table: "โต๊ะ",
  seat: "ที่นั่ง",
};
const snap = (value: number) => Math.round(value / 10) * 10;
function Shape({
  object,
  selected,
  onSelect,
  onChange,
}: {
  object: LayoutObject;
  selected: boolean;
  onSelect: () => void;
  onChange: (v: Partial<LayoutObject>) => void;
}) {
  const ref = useRef<Konva.Group>(null);
  const transformer = useRef<Konva.Transformer>(null);
  useEffect(() => {
    if (selected && ref.current && transformer.current) {
      transformer.current.nodes([ref.current]);
      transformer.current.getLayer()?.batchDraw();
    }
  }, [selected]);
  const fill =
    object.type === "zone"
      ? "#e11d480f"
      : object.type === "stage"
        ? "#46323c"
        : object.type === "table" || object.type === "seat"
          ? "#183c31"
          : object.type === "aisle"
            ? "#1b1b21"
            : "#30303b";
  return (
    <>
      <Group
        ref={ref}
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        rotation={object.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragStart={onSelect}
        onDragEnd={(e) =>
          onChange({
            x: Math.max(0, snap(e.target.x())),
            y: Math.max(0, snap(e.target.y())),
          })
        }
        onTransformEnd={() => {
          const node = ref.current;
          if (!node) return;
          const scaleX = node.scaleX(),
            scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            x: Math.max(0, snap(node.x())),
            y: Math.max(0, snap(node.y())),
            width: Math.max(20, snap(object.width * scaleX)),
            height: Math.max(20, snap(object.height * scaleY)),
            rotation: Math.round(node.rotation()),
          });
        }}
      >
        {object.shape === "circle" ? (
          <Ellipse
            x={object.width / 2}
            y={object.height / 2}
            radiusX={object.width / 2}
            radiusY={object.height / 2}
            fill={fill}
            stroke={selected ? "#fb7185" : "#60606b"}
            strokeWidth={selected ? 2 : 1}
          />
        ) : (
          <Rect
            width={object.width}
            height={object.height}
            fill={fill}
            stroke={selected ? "#fb7185" : "#60606b"}
            strokeWidth={selected ? 2 : 1}
            cornerRadius={5}
            dash={
              object.type === "zone" || object.type === "aisle"
                ? [8, 5]
                : undefined
            }
          />
        )}
        <Text
          text={object.name || object.code}
          width={object.width}
          height={object.type === "zone" ? 28 : object.height}
          align="center"
          verticalAlign="middle"
          fontFamily="Noto Sans Thai Variable"
          fontSize={object.type === "stage" ? 20 : 13}
          fill="#f4f4f5"
          padding={4}
          listening={false}
        />
      </Group>
      {selected ? (
        <Transformer
          ref={transformer}
          rotateEnabled
          keepRatio={false}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
          }
          borderStroke="#fb7185"
          anchorStroke="#fb7185"
          anchorFill="#18181b"
          anchorSize={9}
        />
      ) : null}
    </>
  );
}
export default function LayoutCanvas({
  eventId,
  initial,
  event,
}: {
  eventId: string;
  initial: VenueLayout;
  event: EventData;
}) {
  const [layout, setLayout] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.65);
  const [preview, setPreview] = useState(false);
  const [pan, setPan] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const mutation = useMutation();
  const selected = layout.geometry.objects.find((o) => o.id === selectedId);
  const dirty = JSON.stringify(layout) !== saved;
  const units = (event.units ||
    event.zones?.flatMap((z) => z.units || []) ||
    []) as Unit[];
  const zones = event.zones || [];
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const linkGuard = (e: MouseEvent) => {
      if (!dirty || e.ctrlKey || e.metaKey || e.button !== 0) return;
      const anchor = (e.target as Element).closest?.("a");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.href === window.location.href
      )
        return;
      if (
        !window.confirm(
          "มีการแก้ไขผังที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", guard);
    document.addEventListener("click", linkGuard, true);
    return () => {
      window.removeEventListener("beforeunload", guard);
      document.removeEventListener("click", linkGuard, true);
    };
  }, [dirty]);
  function changeObject(id: string, patch: Partial<LayoutObject>) {
    setLayout((l) => ({
      ...l,
      geometry: {
        objects: l.geometry.objects.map((o) =>
          o.id === id ? { ...o, ...patch } : o,
        ),
      },
    }));
    setMessage("");
  }
  function add(type: LayoutObject["type"]) {
    const id = crypto.randomUUID();
    const code = `${type.toUpperCase()}-${id.slice(0, 5)}`;
    const size =
      type === "zone"
        ? { width: 350, height: 250 }
        : type === "stage"
          ? { width: 260, height: 90 }
          : type === "aisle"
            ? { width: 90, height: 250 }
            : type === "seat"
              ? { width: 35, height: 35 }
              : { width: 90, height: 70 };
    const object: LayoutObject = {
      id,
      code,
      name: typeLabels[type],
      type,
      shape: type === "table" ? "circle" : "rect",
      x: 80,
      y: 80,
      ...size,
      rotation: 0,
      ...(zones[0] ? { zoneId: zones[0].id } : {}),
    };
    setLayout((l) => ({
      ...l,
      geometry: { objects: [...l.geometry.objects, object] },
    }));
    setSelectedId(id);
  }
  function remove() {
    if (!selected) return;
    setLayout((l) => ({
      ...l,
      geometry: {
        objects: l.geometry.objects.filter((o) => o.id !== selected.id),
      },
    }));
    setSelectedId(null);
  }
  function duplicate() {
    if (!selected) return;
    const id = crypto.randomUUID();
    const copy = {
      ...selected,
      id,
      code: `${selected.code.slice(0, 25)}-${id.slice(0, 5)}`,
      x: Math.min(layout.width - selected.width, selected.x + 20),
      y: Math.min(layout.height - selected.height, selected.y + 20),
      unitId: undefined,
    };
    setLayout((l) => ({
      ...l,
      geometry: { objects: [...l.geometry.objects, copy] },
    }));
    setSelectedId(id);
  }
  async function save() {
    try {
      const result = await mutation.run<VenueLayout & { warnings: string[] }>(
        `/api/admin/events/${eventId}/layout`,
        {
          version: layout.version ?? layout.revision ?? 0,
          width: layout.width,
          height: layout.height,
          geometry: layout.geometry,
        },
        "PUT",
      );
      const fresh = { ...layout, ...result };
      setLayout(fresh);
      setSaved(JSON.stringify(fresh));
      setWarnings(result.warnings || []);
      setMessage("บันทึกฉบับร่างแล้ว");
    } catch {}
  }
  async function publish() {
    if (dirty) {
      mutation.setError(new Error("กรุณาบันทึกร่างก่อนเผยแพร่"));
      return;
    }
    if (
      !window.confirm(
        "เผยแพร่ผังเวอร์ชันใหม่สำหรับการจองใหม่? รายการจองเดิมยังใช้ผังเวอร์ชันเดิม",
      )
    )
      return;
    try {
      const result = await mutation.run<{
        draftVersion: number;
        warnings: string[];
      }>(`/api/admin/events/${eventId}/layout/publish`, {
        version: layout.version ?? layout.revision ?? 0,
      });
      const fresh = {
        ...layout,
        version: result.draftVersion,
        revision: result.draftVersion,
      };
      setLayout(fresh);
      setSaved(JSON.stringify(fresh));
      setWarnings(result.warnings || []);
      setMessage("เผยแพร่ผังเวอร์ชันใหม่แล้ว");
    } catch {}
  }
  return (
    <>
      <div className="between" style={{ marginBottom: 20, flexWrap: "wrap" }}>
        <p className="muted" style={{ fontSize: 13 }}>
          ฉบับร่าง v{layout.version ?? layout.revision ?? 0} ·{" "}
          {dirty ? <span className="accent">ยังไม่บันทึก</span> : "บันทึกแล้ว"}
        </p>
        <div className="actions">
          <button
            className="button button-outline button-small"
            onClick={() => setPreview((v) => !v)}
          >
            <Eye size={15} />
            {preview ? "กลับไปแก้ไข" : "พรีวิวลูกค้า"}
          </button>
          <button
            className="button button-outline button-small"
            onClick={save}
            disabled={!dirty || mutation.pending}
          >
            <Save size={15} />
            บันทึกร่าง
          </button>
          <button
            className="button button-small"
            onClick={publish}
            disabled={dirty || mutation.pending}
          >
            <Upload size={15} />
            เผยแพร่ผัง
          </button>
        </div>
      </div>
      <ErrorNotice error={mutation.error} />
      {message ? (
        <div className="notice success-notice" style={{ marginBottom: 18 }}>
          {message}
        </div>
      ) : null}
      {warnings.length ? (
        <div className="notice" style={{ marginBottom: 18 }}>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview ? (
        <VenueView layout={layout} />
      ) : (
        <>
          <div className="editor-toolbar">
            {Object.entries(typeLabels).map(([type, label]) => (
              <button
                key={type}
                className="button button-subtle button-small"
                onClick={() => add(type as LayoutObject["type"])}
              >
                <Plus size={13} />
                {label}
              </button>
            ))}
          </div>
          <div className="editor-layout">
            <div>
              <div className="venue-toolbar">
                <label
                  className="check-label"
                  style={{ margin: 0, marginRight: "auto" }}
                >
                  <input
                    type="checkbox"
                    checked={pan}
                    onChange={(e) => setPan(e.target.checked)}
                  />
                  เลื่อนพื้นที่ผัง
                </label>
                <button
                  className="icon-button"
                  onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
                  aria-label="ย่อผัง"
                >
                  <Minus size={15} />
                </button>
                <span style={{ margin: 0 }}>{Math.round(zoom * 100)}%</span>
                <button
                  className="icon-button"
                  onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
                  aria-label="ขยายผัง"
                >
                  <Plus size={15} />
                </button>
              </div>
              <div
                className="editor-canvas"
                tabIndex={0}
                aria-label="พื้นที่แก้ไขผัง ใช้ลูกศรย้ายวัตถุ Delete ลบ หรือใช้ช่องคุณสมบัติ"
                onKeyDown={(e) => {
                  if (!selected) return;
                  const movement: { [key: string]: [number, number] } = {
                    ArrowLeft: [-10, 0],
                    ArrowRight: [10, 0],
                    ArrowUp: [0, -10],
                    ArrowDown: [0, 10],
                  };
                  if (movement[e.key]) {
                    e.preventDefault();
                    const [x, y] = movement[e.key];
                    changeObject(selected.id, {
                      x: Math.max(0, selected.x + x),
                      y: Math.max(0, selected.y + y),
                    });
                  }
                  if (e.key === "Delete") {
                    e.preventDefault();
                    remove();
                  }
                  if ((e.ctrlKey || e.metaKey) && e.key === "d") {
                    e.preventDefault();
                    duplicate();
                  }
                }}
              >
                <Stage
                  width={layout.width * zoom}
                  height={layout.height * zoom}
                  scaleX={zoom}
                  scaleY={zoom}
                  draggable={pan}
                  onMouseDown={(e) => {
                    if (e.target === e.target.getStage()) setSelectedId(null);
                  }}
                >
                  <Layer>
                    <Rect
                      width={layout.width}
                      height={layout.height}
                      fill="#141419"
                      listening={false}
                    />
                    {Array.from(
                      { length: Math.floor(layout.width / 50) },
                      (_, i) => (
                        <Line
                          key={`v${i}`}
                          points={[i * 50, 0, i * 50, layout.height]}
                          stroke="#25252d"
                          strokeWidth={1}
                          listening={false}
                        />
                      ),
                    )}
                    {Array.from(
                      { length: Math.floor(layout.height / 50) },
                      (_, i) => (
                        <Line
                          key={`h${i}`}
                          points={[0, i * 50, layout.width, i * 50]}
                          stroke="#25252d"
                          strokeWidth={1}
                          listening={false}
                        />
                      ),
                    )}
                    {layout.geometry.objects.map((object) => (
                      <Shape
                        key={object.id}
                        object={object}
                        selected={selectedId === object.id}
                        onSelect={() => setSelectedId(object.id)}
                        onChange={(value) => changeObject(object.id, value)}
                      />
                    ))}
                  </Layer>
                </Stage>
              </div>
              <p className="editor-help">
                พิกัดจริงใช้หน่วยเดียวกันทั้งผัง · ลากแล้วจัดแนวทุก 10 หน่วย ·
                ซูมและเลื่อนภาพไม่เปลี่ยนพิกัดจริง ·
                หน่วยขายต้องผูกกับโซนและหน่วยจากฐานข้อมูล
              </p>
            </div>
            <aside className="editor-properties">
              <h3>คุณสมบัติวัตถุ</h3>
              {selected ? (
                <>
                  <div className="form-grid">
                    <div className="full">
                      <Field label="รหัส">
                        <input
                          value={selected.code}
                          onChange={(e) =>
                            changeObject(selected.id, { code: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <div className="full">
                      <Field label="ชื่อ / ข้อความ">
                        <input
                          value={selected.name}
                          onChange={(e) =>
                            changeObject(selected.id, { name: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <div className="full">
                      <Field label="โซน">
                        <select
                          value={selected.zoneId || ""}
                          onChange={(e) =>
                            changeObject(selected.id, {
                              zoneId: e.target.value || undefined,
                            })
                          }
                        >
                          <option value="">ไม่ได้ระบุ</option>
                          {zones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    {["table", "seat"].includes(selected.type) ? (
                      <div className="full">
                        <Field label="หน่วยขายที่ผูก">
                          <select
                            value={selected.unitId || ""}
                            onChange={(e) => {
                              const unit = units.find(
                                (u) => u.id === e.target.value,
                              );
                              changeObject(selected.id, {
                                unitId: e.target.value || undefined,
                                ...(unit
                                  ? {
                                      zoneId: unit.zoneId,
                                      name: unit.name,
                                      code: unit.code,
                                    }
                                  : {}),
                              });
                            }}
                          >
                            <option value="">เลือกหน่วยขาย</option>
                            {units
                              .filter(
                                (u) =>
                                  u.sellingMode.toLowerCase() === selected.type,
                              )
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.code} · {u.name}
                                </option>
                              ))}
                          </select>
                        </Field>
                      </div>
                    ) : null}
                    <Field label="รูปทรง">
                      <select
                        value={selected.shape}
                        onChange={(e) =>
                          changeObject(selected.id, {
                            shape: e.target.value as "rect" | "circle",
                          })
                        }
                      >
                        <option value="rect">สี่เหลี่ยม</option>
                        <option value="circle">วงกลม / วงรี</option>
                      </select>
                    </Field>
                    {(["x", "y", "width", "height", "rotation"] as const).map(
                      (key) => (
                        <Field
                          key={key}
                          label={
                            {
                              x: "ตำแหน่ง X",
                              y: "ตำแหน่ง Y",
                              width: "ความกว้าง",
                              height: "ความสูง",
                              rotation: "มุมหมุน (องศา)",
                            }[key]
                          }
                        >
                          <input
                            type="number"
                            value={selected[key]}
                            min={
                              key === "rotation"
                                ? -360
                                : key === "width" || key === "height"
                                  ? 1
                                  : 0
                            }
                            max={key === "rotation" ? 360 : 10000}
                            onChange={(e) =>
                              changeObject(selected.id, {
                                [key]: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                      ),
                    )}
                  </div>
                  <div className="actions" style={{ marginTop: 18 }}>
                    <button
                      className="button button-outline button-small"
                      onClick={duplicate}
                    >
                      <Copy size={14} />
                      ทำสำเนา
                    </button>
                    <button
                      className="button button-danger button-small"
                      onClick={remove}
                    >
                      <Trash2 size={14} />
                      ลบ
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted" style={{ fontSize: 12 }}>
                  เลือกวัตถุบนผังหรือจากรายการด้านล่างเพื่อแก้ไข
                </p>
              )}
              <div style={{ marginTop: 25 }}>
                <h3>ขนาดพื้นที่</h3>
                <div className="form-grid">
                  <Field label="ความกว้าง">
                    <input
                      type="number"
                      min={300}
                      max={10000}
                      value={layout.width}
                      onChange={(e) =>
                        setLayout((l) => ({
                          ...l,
                          width: Number(e.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="ความสูง">
                    <input
                      type="number"
                      min={300}
                      max={10000}
                      value={layout.height}
                      onChange={(e) =>
                        setLayout((l) => ({
                          ...l,
                          height: Number(e.target.value),
                        }))
                      }
                    />
                  </Field>
                </div>
              </div>
              <div className="object-list" aria-label="รายการวัตถุ">
                {layout.geometry.objects.map((o) => (
                  <button
                    key={o.id}
                    className={o.id === selectedId ? "active" : ""}
                    onClick={() => setSelectedId(o.id)}
                  >
                    <span>{o.code}</span>
                    <span>{typeLabels[o.type]}</span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
