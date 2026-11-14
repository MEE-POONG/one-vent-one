"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignHorizontalJustifyCenter,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignVerticalSpaceAround,
  Copy,
  Eye,
  Grid3X3,
  LayoutGrid,
  Maximize2,
  Minus,
  MousePointerClick,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useMutation } from "@/lib/client-api";
import type {
  EventData,
  LayoutObject,
  Unit,
  VenueLayout,
} from "@/lib/client-types";
import { ErrorNotice, Field } from "@/components/ui";
import { VenueView } from "@/components/venue-view";
import {
  alignGroupToCanvasCenter,
  alignSelectedObjects,
  cleanPrefix,
  computeTableGridPositions,
  formatTableCode,
  generateTableBatchSpecs,
  getLastTableDefaults,
  getNextTableSequence,
  naturalSortByCode,
  snapAndStraightenGrid,
  snapToGrid,
} from "./table-grid-helpers";
import { WordGridPicker } from "./word-grid-picker";

const typeLabels: Record<LayoutObject["type"], string> = {
  stage: "เวที",
  entrance: "ทางเข้า",
  service: "อื่น ๆ",
  label: "อื่น ๆ",
  aisle: "อื่น ๆ",
  zone: "อื่น ๆ",
  table: "โต๊ะ",
  seat: "ที่นั่ง",
};

// Only Stage, Entrance, and Other (decorative/non-bookable) + Table
const decorativeTypes: Array<{
  type: LayoutObject["type"];
  label: string;
}> = [
  { type: "stage", label: "เวที" },
  { type: "entrance", label: "ทางเข้า" },
  { type: "service", label: "อื่น ๆ" },
];

type MarqueeRect = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
};

function Shape({
  object,
  unit,
  selected,
  isPrimarySelected,
  gridStep,
  dragOffset,
  onSelect,
  onGroupDragStart,
  onGroupDragMove,
  onGroupDragEnd,
  onChange,
}: {
  object: LayoutObject;
  unit?: Unit;
  selected: boolean;
  isPrimarySelected: boolean;
  gridStep: number;
  dragOffset: { dx: number; dy: number } | null;
  onSelect: (additive: boolean) => void;
  onGroupDragStart: () => void;
  onGroupDragMove: (dx: number, dy: number) => void;
  onGroupDragEnd: (dx: number, dy: number) => void;
  onChange: (v: Partial<LayoutObject>) => void;
}) {
  const ref = useRef<Konva.Group>(null);
  const transformer = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isPrimarySelected && ref.current && transformer.current) {
      transformer.current.nodes([ref.current]);
      transformer.current.getLayer()?.batchDraw();
    }
  }, [isPrimarySelected]);

  const fill =
    object.type === "stage"
      ? "#46323c"
      : object.type === "table" || object.type === "seat"
        ? unit
          ? "#183c31"
          : "#443414"
        : object.type === "entrance"
          ? "#253248"
          : "#30303b";

  const effectiveX =
    selected && dragOffset ? Math.max(0, object.x + dragOffset.dx) : object.x;
  const effectiveY =
    selected && dragOffset ? Math.max(0, object.y + dragOffset.dy) : object.y;

  return (
    <>
      <Group
        ref={ref}
        x={effectiveX}
        y={effectiveY}
        width={object.width}
        height={object.height}
        rotation={object.rotation}
        draggable
        onClick={(e) => {
          e.cancelBubble = true;
          const evt = e.evt as MouseEvent | undefined;
          const additive = Boolean(
            evt?.ctrlKey || evt?.metaKey || evt?.shiftKey,
          );
          onSelect(additive);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect(false);
        }}
        onDragStart={(e) => {
          e.cancelBubble = true;
          onGroupDragStart();
        }}
        onDragMove={(e) => {
          const dx = e.target.x() - object.x;
          const dy = e.target.y() - object.y;
          onGroupDragMove(dx, dy);
        }}
        onDragEnd={(e) => {
          const dx = snapToGrid(e.target.x() - object.x, gridStep);
          const dy = snapToGrid(e.target.y() - object.y, gridStep);
          onGroupDragEnd(dx, dy);
        }}
        onTransformEnd={() => {
          const node = ref.current;
          if (!node) return;
          const scaleX = node.scaleX(),
            scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            x: Math.max(0, snapToGrid(node.x(), gridStep)),
            y: Math.max(0, snapToGrid(node.y(), gridStep)),
            width: Math.max(20, snapToGrid(object.width * scaleX, gridStep)),
            height: Math.max(20, snapToGrid(object.height * scaleY, gridStep)),
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
            stroke={selected ? "#fb7185" : unit ? "#318669" : "#60606b"}
            strokeWidth={selected ? 2.5 : 1}
          />
        ) : (
          <Rect
            width={object.width}
            height={object.height}
            fill={fill}
            stroke={selected ? "#fb7185" : unit ? "#318669" : "#60606b"}
            strokeWidth={selected ? 2.5 : 1}
            cornerRadius={6}
          />
        )}
        <Text
          text={
            unit
              ? `${unit.code}\n${unit.admissionCount} ที่ · ฿${Math.round(unit.priceSatang / 100).toLocaleString("th-TH")}`
              : object.name || object.code
          }
          width={object.width}
          height={object.height}
          align="center"
          verticalAlign="middle"
          fontFamily="Noto Sans Thai Variable"
          fontSize={object.type === "stage" ? 20 : unit ? 10 : 13}
          lineHeight={1.2}
          fill="#f4f4f5"
          padding={3}
          listening={false}
        />
      </Group>
      {isPrimarySelected ? (
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
  onEventReload,
}: {
  eventId: string;
  initial: VenueLayout;
  event: EventData;
  onEventReload?: () => Promise<void>;
}) {
  const [layout, setLayout] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [groupDragOffset, setGroupDragOffset] = useState<{
    dx: number;
    dy: number;
    anchorId: string;
  } | null>(null);

  const [zoom, setZoom] = useState(0.75);
  const [fitZoom, setFitZoom] = useState(0.75);
  const [autoFit, setAutoFit] = useState(true);
  const [gridStep, setGridStep] = useState(10);
  const [preview, setPreview] = useState(false);
  const [pan, setPan] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [eventVersion, setEventVersion] = useState(event.version);
  const [units, setUnits] = useState<Unit[]>(
    () =>
      (event.units ||
        event.zones?.flatMap((z) => z.units || []) ||
        []) as Unit[],
  );

  // Active helper panel: "grid" (Word-style add table grid) | "arrange" (auto-arrange existing tables) | null
  const [activeToolPanel, setActiveToolPanel] = useState<
    "grid" | "arrange" | null
  >(null);

  const defaults = useMemo(() => getLastTableDefaults(units), [units]);
  const [gridRows, setGridRows] = useState(4);
  const [gridCols, setGridCols] = useState(6);
  const [gridPrefix, setGridPrefix] = useState(defaults.prefix || "T");
  const [gridCustomStart, setGridCustomStart] = useState<string>("");
  const [gridSeats, setGridSeats] = useState(String(defaults.seats || 4));
  const [gridPrice, setGridPrice] = useState(
    String(defaults.priceBaht || 2400),
  );
  const [gridShape, setGridShape] = useState<"rect" | "circle">("rect");

  // Auto-arrange settings
  const [arrangeCols, setArrangeCols] = useState(6);
  const [arrangeGapX, setArrangeGapX] = useState(20);
  const [arrangeGapY, setArrangeGapY] = useState(20);

  const [unitDraftSeats, setUnitDraftSeats] = useState<Record<string, string>>(
    {},
  );
  const [unitDraftPrice, setUnitDraftPrice] = useState<Record<string, string>>(
    {},
  );
  const [batchSelectedSeats, setBatchSelectedSeats] = useState("4");
  const [batchSelectedPrice, setBatchSelectedPrice] = useState("2400");
  const [newTableSeats, setNewTableSeats] = useState(
    String(defaults.seats || 4),
  );
  const [newTablePrice, setNewTablePrice] = useState(
    String(defaults.priceBaht || 2400),
  );

  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const mutation = useMutation();
  const unitMutation = useMutation();

  const selectedObjects = useMemo(
    () => layout.geometry.objects.filter((o) => selectedIds.includes(o.id)),
    [layout.geometry.objects, selectedIds],
  );
  const primarySelected =
    selectedObjects.length === 1 ? selectedObjects[0] : undefined;

  const selectedTableUnits = useMemo(() => {
    const unitIds = new Set(
      selectedObjects
        .filter((o) => o.type === "table" && o.unitId)
        .map((o) => o.unitId as string),
    );
    return units.filter((u) => unitIds.has(u.id));
  }, [selectedObjects, units]);

  const dirty = JSON.stringify(layout) !== saved;

  // Responsive Fit-to-Screen measurement
  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const updateFit = () => {
      const availableWidth = el.clientWidth - 24;
      if (availableWidth <= 0 || layout.width <= 0) return;
      const computed = Math.min(
        1.15,
        Math.max(0.22, Number((availableWidth / layout.width).toFixed(3))),
      );
      setFitZoom(computed);
      setZoom((prev) => (autoFit ? computed : prev));
    };
    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [layout.width, autoFit, preview]);

  const effectiveZoom = autoFit ? fitZoom : zoom;

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

  const allExistingCodes = useMemo(() => {
    const set = new Set<string>();
    for (const u of units) set.add(u.code);
    for (const o of layout.geometry.objects) set.add(o.code);
    return set;
  }, [units, layout.geometry.objects]);

  const nextAutoStartNum = useMemo(
    () => getNextTableSequence(allExistingCodes, gridPrefix),
    [allExistingCodes, gridPrefix],
  );

  const effectiveStartNum =
    gridCustomStart.trim() !== "" && Number(gridCustomStart) >= 1
      ? Math.floor(Number(gridCustomStart))
      : nextAutoStartNum;

  const previewSpecs = useMemo(
    () =>
      generateTableBatchSpecs({
        prefix: gridPrefix,
        startNumber: effectiveStartNum,
        count: gridRows * gridCols,
        seats: Number(gridSeats) || 4,
        priceBaht: Number(gridPrice) || 2400,
        existingCodes: allExistingCodes,
      }),
    [
      gridPrefix,
      effectiveStartNum,
      gridRows,
      gridCols,
      gridSeats,
      gridPrice,
      allExistingCodes,
    ],
  );

  const unlinkedTableUnits = useMemo(() => {
    const linkedIds = new Set(
      layout.geometry.objects.map((o) => o.unitId).filter(Boolean),
    );
    return naturalSortByCode(
      units.filter(
        (u) => u.sellingMode === "TABLE" && u.active && !linkedIds.has(u.id),
      ),
    );
  }, [units, layout.geometry.objects]);

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

  function handleSelectObject(id: string, additive: boolean) {
    setSelectedIds((prev) => {
      if (additive) {
        return prev.includes(id)
          ? prev.filter((item) => item !== id)
          : [...prev, id];
      }
      return [id];
    });
  }

  async function addSingleTableAuto() {
    const p = cleanPrefix(gridPrefix || "T");
    const nextUnlinked = unlinkedTableUnits[0];
    const tableObjects = layout.geometry.objects.filter(
      (o) => o.type === "table",
    );
    const lastTable = tableObjects[tableObjects.length - 1];
    const nextX = lastTable
      ? lastTable.x + lastTable.width + 20 + 90 <= layout.width - 40
        ? snapToGrid(lastTable.x + lastTable.width + 20, gridStep)
        : 80
      : 80;
    const nextY = lastTable
      ? lastTable.x + lastTable.width + 20 + 90 <= layout.width - 40
        ? lastTable.y
        : snapToGrid(lastTable.y + lastTable.height + 20, gridStep)
      : 160;

    if (nextUnlinked) {
      const id = crypto.randomUUID();
      const obj: LayoutObject = {
        id,
        code: nextUnlinked.code,
        name: nextUnlinked.name,
        type: "table",
        shape: gridShape,
        x: nextX,
        y: nextY,
        width: 90,
        height: 70,
        rotation: 0,
        zoneId: nextUnlinked.zoneId,
        unitId: nextUnlinked.id,
      };
      setLayout((l) => ({
        ...l,
        height: Math.max(l.height, snapToGrid(nextY + 140, gridStep)),
        geometry: { objects: [...l.geometry.objects, obj] },
      }));
      setSelectedIds([id]);
      setMessage(
        `วางและผูกโต๊ะ ${nextUnlinked.code} อัตโนมัติแล้ว (เหลือโต๊ะที่ยังไม่วางอีก ${unlinkedTableUnits.length - 1} โต๊ะ)`,
      );
      return;
    }

    if (event.status === "DRAFT") {
      const specs = generateTableBatchSpecs({
        prefix: p,
        count: 1,
        seats: Number(gridSeats) || 4,
        priceBaht: Number(gridPrice) || 2400,
        existingCodes: allExistingCodes,
      });
      const spec = specs[0];
      if (!spec) return;
      try {
        const res = await unitMutation.run<{
          units: Unit[];
          eventVersion: number;
        }>(
          `/api/admin/events/${eventId}/units/batch`,
          {
            sellingMode: "TABLE",
            units: [spec],
          },
          "POST",
        );
        const createdUnit = res.units[0];
        setEventVersion(res.eventVersion);
        setUnits((prev) => [...prev, ...res.units]);
        const id = crypto.randomUUID();
        const obj: LayoutObject = {
          id,
          code: createdUnit.code,
          name: createdUnit.name,
          type: "table",
          shape: gridShape,
          x: nextX,
          y: nextY,
          width: 90,
          height: 70,
          rotation: 0,
          zoneId: createdUnit.zoneId,
          unitId: createdUnit.id,
        };
        setLayout((l) => ({
          ...l,
          height: Math.max(l.height, snapToGrid(nextY + 140, gridStep)),
          geometry: { objects: [...l.geometry.objects, obj] },
        }));
        setSelectedIds([id]);
        setMessage(
          `เพิ่มโต๊ะ ${createdUnit.code} (${createdUnit.admissionCount} ที่ · ฿${Math.round(createdUnit.priceSatang / 100).toLocaleString("th-TH")}) อัตโนมัติแล้ว`,
        );
        await onEventReload?.();
        return;
      } catch {
        return;
      }
    }

    const nextCode = formatTableCode(p, nextAutoStartNum, 2);
    const id = crypto.randomUUID();
    const obj: LayoutObject = {
      id,
      code: nextCode,
      name: `โต๊ะ ${nextCode}`,
      type: "table",
      shape: gridShape,
      x: nextX,
      y: nextY,
      width: 90,
      height: 70,
      rotation: 0,
    };
    setLayout((l) => ({
      ...l,
      geometry: { objects: [...l.geometry.objects, obj] },
    }));
    setSelectedIds([id]);
  }

  function addDecorative(type: "stage" | "entrance" | "service") {
    const id = crypto.randomUUID();
    const existingOfType = layout.geometry.objects.filter(
      (o) => o.type === type,
    ).length;
    const prefix =
      type === "stage" ? "STAGE" : type === "entrance" ? "ENTRANCE" : "OBJ";
    const baseCode =
      existingOfType === 0 ? prefix : `${prefix}-${existingOfType + 1}`;
    const code = allExistingCodes.has(baseCode)
      ? `${prefix}-${id.slice(0, 4).toUpperCase()}`
      : baseCode;
    const size =
      type === "stage"
        ? { width: 420, height: 70 }
        : type === "entrance"
          ? { width: 150, height: 50 }
          : { width: 140, height: 60 };
    const defaultPos =
      type === "stage"
        ? { x: snapToGrid((layout.width - size.width) / 2, gridStep), y: 30 }
        : type === "entrance"
          ? {
              x: snapToGrid(layout.width - size.width - 50, gridStep),
              y: snapToGrid(layout.height - 70, gridStep),
            }
          : {
              x: snapToGrid(60 + existingOfType * 30, gridStep),
              y: snapToGrid(60 + existingOfType * 30, gridStep),
            };
    const defaultName =
      type === "stage"
        ? "STAGE"
        : type === "entrance"
          ? "ทางเข้า (Entrance)"
          : "จุดสังเกต / อื่น ๆ";
    const object: LayoutObject = {
      id,
      code,
      name: defaultName,
      type,
      shape: "rect",
      ...defaultPos,
      ...size,
      rotation: 0,
    };
    setLayout((l) => ({
      ...l,
      geometry: { objects: [...l.geometry.objects, object] },
    }));
    setSelectedIds([id]);
  }

  function addStandardStageAndEntrance() {
    const hasStage = layout.geometry.objects.some((o) => o.type === "stage");
    const hasEntrance = layout.geometry.objects.some(
      (o) => o.type === "entrance",
    );
    const additions: LayoutObject[] = [];
    if (!hasStage) {
      additions.push({
        id: crypto.randomUUID(),
        code: allExistingCodes.has("STAGE")
          ? `STAGE-${crypto.randomUUID().slice(0, 4)}`
          : "STAGE",
        name: "STAGE",
        type: "stage",
        shape: "rect",
        x: snapToGrid((layout.width - 420) / 2, gridStep),
        y: 30,
        width: 420,
        height: 70,
        rotation: 0,
      });
    }
    if (!hasEntrance) {
      additions.push({
        id: crypto.randomUUID(),
        code: allExistingCodes.has("ENTRANCE")
          ? `ENTRANCE-${crypto.randomUUID().slice(0, 4)}`
          : "ENTRANCE",
        name: "ทางเข้า (Entrance)",
        type: "entrance",
        shape: "rect",
        x: snapToGrid(layout.width - 200, gridStep),
        y: snapToGrid(layout.height - 70, gridStep),
        width: 150,
        height: 50,
        rotation: 0,
      });
    }
    if (additions.length === 0) {
      setMessage("มีเวทีและทางเข้าอยู่ในผังแล้ว");
      return;
    }
    setLayout((l) => ({
      ...l,
      geometry: { objects: [...l.geometry.objects, ...additions] },
    }));
    setMessage("วางเวทีและทางเข้ามาตรฐานลงในผังแล้ว");
  }

  async function createAndPlaceTableGrid(rows: number, cols: number) {
    if (unitMutation.pending) return;
    const totalCount = rows * cols;
    const specs = generateTableBatchSpecs({
      prefix: gridPrefix,
      startNumber: effectiveStartNum,
      count: totalCount,
      seats: Number(gridSeats) || 4,
      priceBaht: Number(gridPrice) || 2400,
      existingCodes: allExistingCodes,
    });
    if (specs.length === 0) return;

    try {
      const res = await unitMutation.run<{
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

      setEventVersion(res.eventVersion);
      setUnits((prev) => [...prev, ...res.units]);

      const gridPlacement = computeTableGridPositions({
        totalCount: res.units.length,
        cols,
        canvasWidth: layout.width,
        canvasHeight: layout.height,
        existingObjects: layout.geometry.objects,
        replaceExistingTables: false,
      });

      const newObjects: LayoutObject[] = res.units.map((u, idx) => {
        const pos = gridPlacement.positions[idx];
        return {
          id: crypto.randomUUID(),
          code: u.code,
          name: u.name,
          type: "table",
          shape: gridShape,
          x: pos.x,
          y: pos.y,
          width: pos.width,
          height: pos.height,
          rotation: 0,
          zoneId: u.zoneId,
          unitId: u.id,
        };
      });

      setLayout((l) => ({
        ...l,
        width: gridPlacement.requiredWidth,
        height: gridPlacement.requiredHeight,
        geometry: {
          objects: [...l.geometry.objects, ...newObjects],
        },
      }));
      setSelectedIds(newObjects.map((o) => o.id));
      setGridCustomStart("");
      setActiveToolPanel(null);
      const firstCode = res.units[0]?.code;
      const lastCode = res.units[res.units.length - 1]?.code;
      setMessage(
        `สร้างและวางตารางโต๊ะ ${rows} แถว × ${cols} โต๊ะ/แถว (${res.units.length} โต๊ะ: ${firstCode} – ${lastCode} · ราคา ฿${Number(gridPrice || 0).toLocaleString("th-TH")}) เรียบร้อย — กด “บันทึกร่าง” เพื่อบันทึกผัง`,
      );
      await onEventReload?.();
    } catch {}
  }

  function placeUnlinkedUnitsAsGrid(cols: number) {
    if (unlinkedTableUnits.length === 0) return;
    const gridPlacement = computeTableGridPositions({
      totalCount: unlinkedTableUnits.length,
      cols,
      canvasWidth: layout.width,
      canvasHeight: layout.height,
      existingObjects: layout.geometry.objects,
      replaceExistingTables: false,
    });
    const newObjects: LayoutObject[] = unlinkedTableUnits.map((u, idx) => {
      const pos = gridPlacement.positions[idx];
      return {
        id: crypto.randomUUID(),
        code: u.code,
        name: u.name,
        type: "table",
        shape: gridShape,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        rotation: 0,
        zoneId: u.zoneId,
        unitId: u.id,
      };
    });
    setLayout((l) => ({
      ...l,
      width: gridPlacement.requiredWidth,
      height: gridPlacement.requiredHeight,
      geometry: {
        objects: [...l.geometry.objects, ...newObjects],
      },
    }));
    setSelectedIds(newObjects.map((o) => o.id));
    setActiveToolPanel(null);
    setMessage(
      `นำโต๊ะที่ยังไม่วาง ${unlinkedTableUnits.length} โต๊ะ มาจัดเรียง ${cols} โต๊ะ/แถว เรียบร้อย`,
    );
  }

  function autoArrangeTables(cols: number, onlySelected = false) {
    const selectedSet = new Set(selectedIds);
    const targetTables = naturalSortByCode(
      layout.geometry.objects.filter(
        (o) =>
          o.type === "table" && (!onlySelected || selectedSet.has(o.id)),
      ),
    );
    if (targetTables.length === 0) {
      setMessage("ไม่มีโต๊ะให้จัดเรียง");
      return;
    }
    const otherObjects = layout.geometry.objects.filter(
      (o) => !targetTables.some((t) => t.id === o.id),
    );
    const gridPlacement = computeTableGridPositions({
      totalCount: targetTables.length,
      cols,
      canvasWidth: layout.width,
      canvasHeight: layout.height,
      existingObjects: otherObjects,
      replaceExistingTables: !onlySelected,
      gapX: arrangeGapX,
      gapY: arrangeGapY,
    });
    const updatedMap = new Map<string, LayoutObject>();
    targetTables.forEach((obj, idx) => {
      const pos = gridPlacement.positions[idx];
      updatedMap.set(obj.id, {
        ...obj,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        rotation: 0,
      });
    });

    const nextObjects = layout.geometry.objects.map((o) => {
      const arranged = updatedMap.get(o.id);
      if (arranged) return arranged;
      if (
        o.type === "entrance" &&
        gridPlacement.requiredHeight > layout.height
      ) {
        return {
          ...o,
          y: snapToGrid(gridPlacement.requiredHeight - o.height - 20, gridStep),
        };
      }
      return o;
    });

    setLayout((l) => ({
      ...l,
      width: gridPlacement.requiredWidth,
      height: gridPlacement.requiredHeight,
      geometry: { objects: nextObjects },
    }));
    setActiveToolPanel(null);
    setMessage(
      `จัดเรียงโต๊ะ ${targetTables.length} โต๊ะ (${gridPlacement.rows} แถว × ${cols} โต๊ะ/แถว) เข้าตารางเรียบร้อย`,
    );
  }

  function handleGridAlign() {
    const targets = selectedIds.length >= 2 ? selectedIds : undefined;
    setLayout((l) => ({
      ...l,
      geometry: {
        objects: snapAndStraightenGrid({
          objects: l.geometry.objects,
          targetIds: targets,
          gridStep,
        }),
      },
    }));
    setMessage(
      targets
        ? `ดึงแนวแถวและคอลัมน์ของ ${targets.length} รายการที่เลือกให้ตรงตารางแล้ว`
        : "ดึงแนวแถวและคอลัมน์ของโต๊ะทั้งหมดให้ตรงตาราง (Grid Align) เรียบร้อยแล้ว",
    );
  }

  function handleCenterGroupOnCanvas(
    onlySelected: boolean,
    axis: "both" | "horizontal" | "vertical" = "both",
  ) {
    if (layout.geometry.objects.length === 0) return;
    const targets =
      onlySelected && selectedIds.length > 0 ? selectedIds : undefined;
    setLayout((l) => ({
      ...l,
      geometry: {
        objects: alignGroupToCanvasCenter({
          objects: l.geometry.objects,
          targetIds: targets,
          canvasWidth: l.width,
          canvasHeight: l.height,
          axis,
          gridStep,
        }),
      },
    }));
    setMessage(
      targets
        ? `จัดกลุ่มที่เลือก (${targets.length} รายการ) ให้อยู่กึ่งกลางผังทั้งชุดเรียบร้อยแล้ว`
        : "จัดทุก Object ทั้งผังให้อยู่กึ่งกลางผังเป็นชุดเดียวกันเรียบร้อยแล้ว",
    );
  }

  function handleAlignSelection(
    mode:
      | "left"
      | "center-h"
      | "right"
      | "top"
      | "center-v"
      | "bottom"
      | "distribute-h"
      | "distribute-v",
  ) {
    if (selectedIds.length < 2) return;
    setLayout((l) => ({
      ...l,
      geometry: {
        objects: alignSelectedObjects({
          objects: l.geometry.objects,
          selectedIds,
          mode,
          gridStep,
        }),
      },
    }));
  }

  function removeSelected() {
    if (selectedIds.length === 0) return;
    const removeSet = new Set(selectedIds);
    setLayout((l) => ({
      ...l,
      geometry: {
        objects: l.geometry.objects.filter((o) => !removeSet.has(o.id)),
      },
    }));
    setSelectedIds([]);
  }

  function duplicateSelected() {
    if (selectedObjects.length === 0) return;
    let nextNum = nextAutoStartNum;
    const copies: LayoutObject[] = selectedObjects.map((orig) => {
      const id = crypto.randomUUID();
      const nextCode =
        orig.type === "table"
          ? formatTableCode(gridPrefix || "T", nextNum++, 2)
          : `${orig.code.slice(0, 25)}-${id.slice(0, 4)}`;
      return {
        ...orig,
        id,
        code: nextCode,
        name: orig.type === "table" ? `โต๊ะ ${nextCode}` : orig.name,
        x: Math.min(layout.width - orig.width, orig.x + 20),
        y: Math.min(layout.height - orig.height, orig.y + 20),
        unitId: undefined,
      };
    });
    setLayout((l) => ({
      ...l,
      geometry: { objects: [...l.geometry.objects, ...copies] },
    }));
    setSelectedIds(copies.map((c) => c.id));
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
      await onEventReload?.();
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
      await onEventReload?.();
    } catch {}
  }

  const tableObjectsCount = layout.geometry.objects.filter(
    (o) => o.type === "table",
  ).length;

  return (
    <>
      <div
        className="between"
        style={{ marginBottom: 20, flexWrap: "wrap", gap: 12 }}
      >
        <p className="muted" style={{ fontSize: 13 }}>
          ฉบับร่าง v{layout.version ?? layout.revision ?? 0} · โต๊ะในผัง{" "}
          {tableObjectsCount} โต๊ะ · เลือกอยู่ {selectedIds.length} รายการ ·{" "}
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
      <ErrorNotice error={mutation.error || unitMutation.error} />
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
      {unlinkedTableUnits.length > 0 && !preview ? (
        <div
          className="notice"
          style={{
            marginBottom: 18,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <span>
            มีโต๊ะที่สร้างไว้แล้วแต่ยังไม่ได้วางลงในผังจำนวน{" "}
            <strong>{unlinkedTableUnits.length} โต๊ะ</strong> (
            {unlinkedTableUnits[0]?.code} –{" "}
            {unlinkedTableUnits[unlinkedTableUnits.length - 1]?.code})
          </span>
          <button
            type="button"
            className="button button-small"
            onClick={() => placeUnlinkedUnitsAsGrid(gridCols || 6)}
          >
            <LayoutGrid size={14} />
            วางและจัดเรียงทั้ง {unlinkedTableUnits.length} โต๊ะลงผังอัตโนมัติ
          </button>
        </div>
      ) : null}
      {preview ? (
        <VenueView layout={layout} units={units} tablesOnly />
      ) : (
        <>
          <div className="editor-toolbar">
            <button
              type="button"
              className={`button button-small ${activeToolPanel === "grid" ? "" : "button-outline"}`}
              onClick={() =>
                setActiveToolPanel((v) => (v === "grid" ? null : "grid"))
              }
            >
              <Grid3X3 size={14} />
              เพิ่มตารางโต๊ะ (แถว × โต๊ะ)
            </button>
            <button
              type="button"
              className="button button-subtle button-small"
              disabled={unitMutation.pending}
              onClick={() => void addSingleTableAuto()}
            >
              <Plus size={13} />
              โต๊ะเดี่ยว ({formatTableCode(gridPrefix || "T", nextAutoStartNum)})
            </button>

            <span className="editor-toolbar-divider" aria-hidden />

            {decorativeTypes.map((item) => (
              <button
                key={item.type}
                type="button"
                className="button button-subtle button-small"
                onClick={() =>
                  addDecorative(item.type as "stage" | "entrance" | "service")
                }
                title={`วาง ${item.label} (สำหรับแสดงให้ลูกค้าเห็นตำแหน่งในร้าน ไม่สามารถกดจองได้)`}
              >
                <Plus size={13} />
                {item.label}
              </button>
            ))}

            <span className="editor-toolbar-divider" aria-hidden />

            <button
              type="button"
              className="button button-outline button-small"
              onClick={handleGridAlign}
              title="ดึงแนวแถวและคอลัมน์ของโต๊ะให้ตรงเส้นตารางอย่างสวยงาม"
            >
              <Sparkles size={14} />
              Grid Align (ดึงแถว/คอลัมน์ให้ตรง)
            </button>
            <button
              type="button"
              className="button button-outline button-small"
              onClick={() => handleCenterGroupOnCanvas(false, "both")}
              title="เสมือนเลือกทุก Object แล้ว Group จากนั้นจัดให้อยู่กึ่งกลางผังทั้งชุดพร้อมกัน"
            >
              <AlignHorizontalJustifyCenter size={14} />
              จัดทุก Object อยู่กึ่งกลางผัง (ทั้งชุด)
            </button>
            <button
              type="button"
              className={`button button-small ${activeToolPanel === "arrange" ? "" : "button-subtle"}`}
              onClick={() =>
                setActiveToolPanel((v) => (v === "arrange" ? null : "arrange"))
              }
            >
              <LayoutGrid size={14} />
              เรียงตารางโต๊ะใหม่ ({tableObjectsCount})
            </button>
          </div>

          {selectedIds.length >= 2 ? (
            <div className="editor-selection-bar">
              <span className="editor-selection-badge">
                <MousePointerClick size={14} />
                เลือกอยู่ {selectedIds.length} รายการ
              </span>
              <button
                type="button"
                className="button button-subtle button-small"
                onClick={() => handleCenterGroupOnCanvas(true, "both")}
                title="จัดกลุ่มที่เลือกให้อยู่กึ่งกลางผังโดยรักษาระยะห่างเดิมระหว่างกัน"
              >
                <AlignHorizontalJustifyCenter size={13} />
                จัดชุดที่เลือกกึ่งกลางผัง
              </button>
              <button
                type="button"
                className="button button-subtle button-small"
                onClick={handleGridAlign}
                title="ดึงแถวและคอลัมน์ของรายการที่เลือกให้ตรงกัน"
              >
                <Grid3X3 size={13} />
                Grid Align ชุดที่เลือก
              </button>
              <span className="editor-toolbar-divider" aria-hidden />
              <button
                type="button"
                className="button button-subtle button-small"
                onClick={() => handleAlignSelection("left")}
                title="จัดชิดซ้ายเท่ากัน"
              >
                <AlignStartVertical size={13} />
                ชิดซ้าย
              </button>
              <button
                type="button"
                className="button button-subtle button-small"
                onClick={() => handleAlignSelection("center-h")}
                title="จัดกึ่งกลางแนวนอนตรงกัน"
              >
                <AlignCenterVertical size={13} />
                กึ่งกลางแนวนอน
              </button>
              <button
                type="button"
                className="button button-subtle button-small"
                onClick={() => handleAlignSelection("right")}
                title="จัดชิดขวาเท่ากัน"
              >
                <AlignEndVertical size={13} />
                ชิดขวา
              </button>
              <button
                type="button"
                className="button button-subtle button-small"
                onClick={() => handleAlignSelection("top")}
                title="จัดชิดบนเท่ากัน (แถวเดียวกัน)"
              >
                <AlignStartHorizontal size={13} />
                ชิดบน
              </button>
              <button
                type="button"
                className="button button-subtle button-small"
                onClick={() => handleAlignSelection("center-v")}
                title="จัดกึ่งกลางแนวตั้งตรงกัน"
              >
                <AlignCenterHorizontal size={13} />
                กึ่งกลางแนวตั้ง
              </button>
              <button
                type="button"
                className="button button-subtle button-small"
                onClick={() => handleAlignSelection("bottom")}
                title="จัดชิดล่างเท่ากัน"
              >
                <AlignEndHorizontal size={13} />
                ชิดล่าง
              </button>
              {selectedIds.length >= 3 ? (
                <>
                  <button
                    type="button"
                    className="button button-subtle button-small"
                    onClick={() => handleAlignSelection("distribute-h")}
                    title="กระจายระยะห่างแนวนอนเท่ากัน"
                  >
                    <AlignHorizontalSpaceAround size={13} />
                    กระจายแนวนอน
                  </button>
                  <button
                    type="button"
                    className="button button-subtle button-small"
                    onClick={() => handleAlignSelection("distribute-v")}
                    title="กระจายระยะห่างแนวตั้งเท่ากัน"
                  >
                    <AlignVerticalSpaceAround size={13} />
                    กระจายแนวตั้ง
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="button button-danger button-small"
                style={{ marginLeft: "auto" }}
                onClick={removeSelected}
              >
                <Trash2 size={13} />
                ลบที่เลือก ({selectedIds.length})
              </button>
            </div>
          ) : null}

          {activeToolPanel === "grid" ? (
            <div className="editor-popover-panel">
              <div
                className="between"
                style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>
                    เพิ่มชุดโต๊ะแบบตาราง (กำหนดที่นั่งและราคาตามชุดโต๊ะที่สร้าง)
                  </h3>
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    ระบุจำนวนที่นั่งและราคาของโต๊ะชุดนี้ แล้วเลือกตาราง{" "}
                    <strong>แถว × โต๊ะต่อแถว</strong> เหมือนใน Microsoft Word
                    ระบบจะรันเลขโต๊ะต่อเนื่องและวางลงผังให้ทันที
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-subtle button-small"
                  onClick={() => setActiveToolPanel(null)}
                >
                  ปิดหน้าต่างนี้
                </button>
              </div>

              {event.status !== "DRAFT" ? (
                <div className="notice" style={{ marginBottom: 14 }}>
                  อีเวนท์นี้อยู่ในสถานะเปิดขาย/ปิดขายแล้ว หากต้องการเพิ่มโต๊ะใหม่ในฐานข้อมูล
                  กรุณาปิดการขายและกด “กลับเป็นฉบับร่าง” ในหน้ารายละเอียดงานก่อน
                </div>
              ) : null}

              <div className="editor-grid-builder-layout">
                <div className="stack-sm">
                  <div className="form-grid">
                    <Field
                      label="คำนำหน้ารหัส (Prefix)"
                      hint="เช่น T, VIP, A"
                    >
                      <input
                        value={gridPrefix}
                        onChange={(e) => setGridPrefix(e.target.value)}
                        placeholder="T"
                      />
                    </Field>
                    <Field
                      label="เริ่มรันจากเลข (Auto-Increment)"
                      hint={`ว่างไว้ = ต่อจากเดิมอัตโนมัติ (${formatTableCode(gridPrefix, nextAutoStartNum)})`}
                    >
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={gridCustomStart}
                          placeholder={String(nextAutoStartNum)}
                          onChange={(e) => setGridCustomStart(e.target.value)}
                        />
                        {gridCustomStart ? (
                          <button
                            type="button"
                            className="button button-subtle button-small"
                            onClick={() => setGridCustomStart("")}
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
                        value={gridSeats}
                        onChange={(e) => setGridSeats(e.target.value)}
                      />
                    </Field>
                    <Field label="ราคาขายของชุดโต๊ะนี้ (บาท/โต๊ะ)">
                      <input
                        type="number"
                        min={1}
                        step="0.01"
                        value={gridPrice}
                        onChange={(e) => setGridPrice(e.target.value)}
                      />
                    </Field>
                    <Field label="รูปทรงโต๊ะ">
                      <select
                        value={gridShape}
                        onChange={(e) =>
                          setGridShape(e.target.value as "rect" | "circle")
                        }
                      >
                        <option value="rect">สี่เหลี่ยม</option>
                        <option value="circle">วงกลม / วงรี</option>
                      </select>
                    </Field>
                  </div>

                  <div className="actions" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="button"
                      disabled={
                        unitMutation.pending || event.status !== "DRAFT"
                      }
                      onClick={() => createAndPlaceTableGrid(gridRows, gridCols)}
                    >
                      <Grid3X3 size={15} />
                      {unitMutation.pending
                        ? "กำลังสร้างและจัดวางโต๊ะ..."
                        : `สร้างและวางตารางโต๊ะ ${gridRows}×${gridCols} (${gridRows * gridCols} โต๊ะ: ${previewSpecs[0]?.code ?? ""} – ${previewSpecs[previewSpecs.length - 1]?.code ?? ""})`}
                    </button>
                    <button
                      type="button"
                      className="button button-subtle button-small"
                      onClick={addStandardStageAndEntrance}
                    >
                      + วางเวทีและทางเข้ามาตรฐาน
                    </button>
                  </div>
                </div>

                <WordGridPicker
                  rows={gridRows}
                  cols={gridCols}
                  defaultInstant={true}
                  disabled={unitMutation.pending || event.status !== "DRAFT"}
                  codePreview={
                    previewSpecs.length
                      ? `รหัสอัตโนมัติ: ${previewSpecs[0].code} – ${previewSpecs[previewSpecs.length - 1].code} (${gridSeats || 4} ที่ · ฿${Number(gridPrice || 0).toLocaleString("th-TH")}/โต๊ะ)`
                      : undefined
                  }
                  onSelect={(r, c) => {
                    setGridRows(r);
                    setGridCols(c);
                  }}
                  onInstantCommit={(r, c) => {
                    setGridRows(r);
                    setGridCols(c);
                    void createAndPlaceTableGrid(r, c);
                  }}
                />
              </div>
            </div>
          ) : null}

          {activeToolPanel === "arrange" ? (
            <div className="editor-popover-panel">
              <div
                className="between"
                style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>
                    จัดเรียงโต๊ะเข้าตารางอัตโนมัติ (เรียงตามรหัส T01 → T99)
                  </h3>
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    กำหนดจำนวนโต๊ะต่อแถวและระยะห่างเพื่อให้โต๊ะเรียงแถวตรงกันสวยงาม
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-subtle button-small"
                  onClick={() => setActiveToolPanel(null)}
                >
                  ปิดหน้าต่างนี้
                </button>
              </div>
              <div className="form-grid" style={{ alignItems: "end" }}>
                <Field label="จำนวนโต๊ะต่อแถว (คอลัมน์)">
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[4, 5, 6, 8, 10].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`button button-small ${arrangeCols === c ? "" : "button-outline"}`}
                        onClick={() => setArrangeCols(c)}
                      >
                        {c} โต๊ะ/แถว
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={20}
                      style={{ width: 80 }}
                      value={arrangeCols}
                      onChange={(e) =>
                        setArrangeCols(
                          Math.max(1, Math.min(20, Number(e.target.value) || 6)),
                        )
                      }
                    />
                  </div>
                </Field>
                <Field label="ระยะห่างแนวนอน (px)">
                  <input
                    type="number"
                    min={10}
                    max={100}
                    step={10}
                    value={arrangeGapX}
                    onChange={(e) =>
                      setArrangeGapX(Number(e.target.value) || 20)
                    }
                  />
                </Field>
                <Field label="ระยะห่างแนวตั้ง (px)">
                  <input
                    type="number"
                    min={10}
                    max={100}
                    step={10}
                    value={arrangeGapY}
                    onChange={(e) =>
                      setArrangeGapY(Number(e.target.value) || 20)
                    }
                  />
                </Field>
              </div>
              <div className="actions" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="button"
                  onClick={() => autoArrangeTables(arrangeCols, false)}
                >
                  <LayoutGrid size={15} />
                  เรียงโต๊ะทั้งหมด ({tableObjectsCount} โต๊ะ) เป็น {arrangeCols}{" "}
                  โต๊ะ/แถว
                </button>
                {selectedIds.length >= 2 ? (
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => autoArrangeTables(arrangeCols, true)}
                  >
                    เรียงเฉพาะโต๊ะที่เลือก ({selectedIds.length} รายการ)
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="editor-layout">
            <div style={{ minWidth: 0 }}>
              <div className="venue-toolbar" style={{ flexWrap: "wrap" }}>
                <label
                  className="check-label"
                  style={{ margin: 0 }}
                  title="เมื่อไม่ติ๊ก: ลากเมาส์บนพื้นที่ว่างเพื่อคลุมเลือกหลาย Object"
                >
                  <input
                    type="checkbox"
                    checked={pan}
                    onChange={(e) => setPan(e.target.checked)}
                  />
                  เลื่อนพื้นที่ผัง (ปิดเพื่อลากเมาส์คลุมเลือก Object)
                </label>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginLeft: "auto",
                  }}
                >
                  <button
                    type="button"
                    className="button button-subtle button-small"
                    style={{ padding: "5px 9px", fontSize: 11 }}
                    onClick={() =>
                      setSelectedIds(layout.geometry.objects.map((o) => o.id))
                    }
                  >
                    เลือกทั้งหมด ({layout.geometry.objects.length})
                  </button>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11.5,
                      color: "#a1a1aa",
                    }}
                  >
                    <span>Grid:</span>
                    <select
                      value={gridStep}
                      onChange={(e) => setGridStep(Number(e.target.value))}
                      style={{
                        background: "#101014",
                        color: "#f4f4f5",
                        border: "1px solid #3f3f4a",
                        borderRadius: 6,
                        padding: "3px 6px",
                        fontSize: 11.5,
                      }}
                    >
                      <option value={10}>10px</option>
                      <option value={20}>20px</option>
                      <option value={25}>25px</option>
                      <option value={50}>50px</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className={`button button-small ${autoFit ? "" : "button-subtle"}`}
                    style={{ padding: "5px 10px", fontSize: 11 }}
                    onClick={() => {
                      setAutoFit(true);
                      setZoom(fitZoom);
                    }}
                  >
                    <Maximize2 size={13} />
                    พอดีจอ (Fit)
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      setAutoFit(false);
                      setZoom((z) =>
                        Math.max(
                          0.25,
                          Number(((autoFit ? fitZoom : z) - 0.1).toFixed(2)),
                        ),
                      );
                    }}
                    aria-label="ย่อผัง"
                  >
                    <Minus size={15} />
                  </button>
                  <span
                    style={{ margin: 0, minWidth: 42, textAlign: "center" }}
                  >
                    {Math.round(effectiveZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      setAutoFit(false);
                      setZoom((z) =>
                        Math.min(
                          1.5,
                          Number(((autoFit ? fitZoom : z) + 0.1).toFixed(2)),
                        ),
                      );
                    }}
                    aria-label="ขยายผัง"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
              <div
                ref={canvasWrapRef}
                className="editor-canvas"
                tabIndex={0}
                aria-label="พื้นที่แก้ไขผัง ลากเมาส์คลุมหรือกด Ctrl+Click เพื่อเลือกหลายรายการ ใช้ลูกศรย้ายวัตถุ Delete ลบ"
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
                    e.preventDefault();
                    setSelectedIds(layout.geometry.objects.map((o) => o.id));
                    return;
                  }
                  if (selectedIds.length === 0) return;
                  const movement: { [key: string]: [number, number] } = {
                    ArrowLeft: [-gridStep, 0],
                    ArrowRight: [gridStep, 0],
                    ArrowUp: [0, -gridStep],
                    ArrowDown: [0, gridStep],
                  };
                  if (movement[e.key]) {
                    e.preventDefault();
                    const [dx, dy] = movement[e.key];
                    const selectedSet = new Set(selectedIds);
                    setLayout((l) => ({
                      ...l,
                      geometry: {
                        objects: l.geometry.objects.map((o) =>
                          selectedSet.has(o.id)
                            ? {
                                ...o,
                                x: Math.max(0, o.x + dx),
                                y: Math.max(0, o.y + dy),
                              }
                            : o,
                        ),
                      },
                    }));
                  }
                  if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    removeSelected();
                  }
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
                    e.preventDefault();
                    duplicateSelected();
                  }
                }}
              >
                <Stage
                  ref={stageRef}
                  width={Math.round(layout.width * effectiveZoom)}
                  height={Math.round(layout.height * effectiveZoom)}
                  scaleX={effectiveZoom}
                  scaleY={effectiveZoom}
                  draggable={pan}
                  onMouseDown={(e) => {
                    if (pan) return;
                    if (e.target !== e.target.getStage()) return;
                    const stage = e.target.getStage();
                    const pointer = stage?.getPointerPosition();
                    if (!pointer) return;
                    const x = pointer.x / effectiveZoom;
                    const y = pointer.y / effectiveZoom;
                    const evt = e.evt as MouseEvent | undefined;
                    const additive = Boolean(
                      evt?.ctrlKey || evt?.metaKey || evt?.shiftKey,
                    );
                    setMarquee({
                      startX: x,
                      startY: y,
                      currentX: x,
                      currentY: y,
                      additive,
                    });
                    if (!additive) {
                      setSelectedIds([]);
                    }
                  }}
                  onMouseMove={(e) => {
                    if (!marquee) return;
                    const stage = e.target.getStage();
                    const pointer = stage?.getPointerPosition();
                    if (!pointer) return;
                    const x = pointer.x / effectiveZoom;
                    const y = pointer.y / effectiveZoom;
                    setMarquee((prev) =>
                      prev ? { ...prev, currentX: x, currentY: y } : null,
                    );
                  }}
                  onMouseUp={() => {
                    if (!marquee) return;
                    const minX = Math.min(marquee.startX, marquee.currentX);
                    const maxX = Math.max(marquee.startX, marquee.currentX);
                    const minY = Math.min(marquee.startY, marquee.currentY);
                    const maxY = Math.max(marquee.startY, marquee.currentY);
                    const draggedDistance =
                      Math.abs(maxX - minX) + Math.abs(maxY - minY);

                    if (draggedDistance > 5) {
                      const hitIds = layout.geometry.objects
                        .filter(
                          (o) =>
                            o.x < maxX &&
                            o.x + o.width > minX &&
                            o.y < maxY &&
                            o.y + o.height > minY,
                        )
                        .map((o) => o.id);
                      setSelectedIds((prev) =>
                        marquee.additive
                          ? Array.from(new Set([...prev, ...hitIds]))
                          : hitIds,
                      );
                    }
                    setMarquee(null);
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
                      {
                        length: Math.floor(
                          layout.width / Math.max(25, gridStep * 2),
                        ),
                      },
                      (_, i) => {
                        const stepDraw = Math.max(25, gridStep * 2);
                        return (
                          <Line
                            key={`v${i}`}
                            points={[
                              i * stepDraw,
                              0,
                              i * stepDraw,
                              layout.height,
                            ]}
                            stroke="#25252d"
                            strokeWidth={1}
                            listening={false}
                          />
                        );
                      },
                    )}
                    {Array.from(
                      {
                        length: Math.floor(
                          layout.height / Math.max(25, gridStep * 2),
                        ),
                      },
                      (_, i) => {
                        const stepDraw = Math.max(25, gridStep * 2);
                        return (
                          <Line
                            key={`h${i}`}
                            points={[
                              0,
                              i * stepDraw,
                              layout.width,
                              i * stepDraw,
                            ]}
                            stroke="#25252d"
                            strokeWidth={1}
                            listening={false}
                          />
                        );
                      },
                    )}
                    {/* Center crosshair subtle guide lines */}
                    <Line
                      points={[layout.width / 2, 0, layout.width / 2, layout.height]}
                      stroke="#fb718526"
                      strokeWidth={1}
                      dash={[6, 6]}
                      listening={false}
                    />
                    <Line
                      points={[0, layout.height / 2, layout.width, layout.height / 2]}
                      stroke="#fb718526"
                      strokeWidth={1}
                      dash={[6, 6]}
                      listening={false}
                    />
                    {layout.geometry.objects.map((object) => {
                      const isSelected = selectedIds.includes(object.id);
                      const isOtherInDraggedGroup =
                        isSelected &&
                        groupDragOffset &&
                        groupDragOffset.anchorId !== object.id;
                      return (
                        <Shape
                          key={object.id}
                          object={object}
                          unit={
                            object.unitId
                              ? units.find((u) => u.id === object.unitId)
                              : undefined
                          }
                          selected={isSelected}
                          isPrimarySelected={
                            selectedIds.length === 1 && isSelected
                          }
                          gridStep={gridStep}
                          dragOffset={
                            isOtherInDraggedGroup
                              ? {
                                  dx: groupDragOffset.dx,
                                  dy: groupDragOffset.dy,
                                }
                              : null
                          }
                          onSelect={(additive) =>
                            handleSelectObject(object.id, additive)
                          }
                          onGroupDragStart={() => {
                            if (!selectedIds.includes(object.id)) {
                              setSelectedIds([object.id]);
                            }
                            setGroupDragOffset({
                              dx: 0,
                              dy: 0,
                              anchorId: object.id,
                            });
                          }}
                          onGroupDragMove={(dx, dy) => {
                            if (selectedIds.length > 1) {
                              setGroupDragOffset({
                                dx,
                                dy,
                                anchorId: object.id,
                              });
                            }
                          }}
                          onGroupDragEnd={(dx, dy) => {
                            setGroupDragOffset(null);
                            const activeSet = selectedIds.includes(object.id)
                              ? new Set(selectedIds)
                              : new Set([object.id]);
                            setLayout((l) => ({
                              ...l,
                              geometry: {
                                objects: l.geometry.objects.map((o) =>
                                  activeSet.has(o.id)
                                    ? {
                                        ...o,
                                        x: Math.max(
                                          0,
                                          snapToGrid(o.x + dx, gridStep),
                                        ),
                                        y: Math.max(
                                          0,
                                          snapToGrid(o.y + dy, gridStep),
                                        ),
                                      }
                                    : o,
                                ),
                              },
                            }));
                          }}
                          onChange={(value) => changeObject(object.id, value)}
                        />
                      );
                    })}
                    {marquee ? (
                      <Rect
                        x={Math.min(marquee.startX, marquee.currentX)}
                        y={Math.min(marquee.startY, marquee.currentY)}
                        width={Math.abs(marquee.currentX - marquee.startX)}
                        height={Math.abs(marquee.currentY - marquee.startY)}
                        fill="#e11d4824"
                        stroke="#fb7185"
                        strokeWidth={1.5}
                        dash={[6, 4]}
                        listening={false}
                      />
                    ) : null}
                  </Layer>
                </Stage>
              </div>
              <p className="editor-help">
                <strong>วิธีเลือกหลาย Object:</strong> ลากเมาส์คลุมบนพื้นที่ว่าง
                หรือกด <code>Ctrl + Click</code> ที่แต่ละ Object · ลากย้ายพร้อมกันทั้งกลุ่มได้ทันที ·
                กดปุ่ม <strong>“จัดทุก Object อยู่กึ่งกลางผัง (ทั้งชุด)”</strong>{" "}
                เพื่อเลื่อนผังทั้งหมดให้อยู่ตรงกลางโดยรักษารูปขบวนเดิม
              </p>
            </div>

            <aside className="editor-properties">
              <h3>คุณสมบัติและการตั้งค่า</h3>
              {selectedIds.length > 1 ? (
                <div className="stack-sm">
                  <div className="panel stack-sm" style={{ padding: 14 }}>
                    <strong>เลือกอยู่ {selectedIds.length} รายการ</strong>
                    <p className="muted" style={{ fontSize: 12 }}>
                      สามารถลากย้ายพร้อมกันทั้งกลุ่ม ใช้ปุ่มลูกศรเลื่อน หรือจัดแนวจากแถบด้านบนได้ทันที
                    </p>
                    <button
                      type="button"
                      className="button button-outline button-small"
                      onClick={() => handleCenterGroupOnCanvas(true, "both")}
                    >
                      <AlignHorizontalJustifyCenter size={14} />
                      จัดกลุ่มที่เลือกอยู่กึ่งกลางผัง
                    </button>
                    <button
                      type="button"
                      className="button button-outline button-small"
                      onClick={handleGridAlign}
                    >
                      <Grid3X3 size={14} />
                      ดึงแถว/คอลัมน์ให้ตรง (Grid Align)
                    </button>
                  </div>

                  {selectedTableUnits.length > 0 ? (
                    <div className="panel stack-sm" style={{ padding: 14 }}>
                      <strong style={{ fontSize: 13 }}>
                        ตั้งค่าราคาและที่นั่งของโต๊ะที่เลือก (
                        {selectedTableUnits.length} โต๊ะ)
                      </strong>
                      <div className="form-grid">
                        <Field label="จำนวนที่นั่ง/โต๊ะ">
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={batchSelectedSeats}
                            onChange={(e) =>
                              setBatchSelectedSeats(e.target.value)
                            }
                          />
                        </Field>
                        <Field label="ราคาขาย (บาท/โต๊ะ)">
                          <input
                            type="number"
                            min={1}
                            step="0.01"
                            value={batchSelectedPrice}
                            onChange={(e) =>
                              setBatchSelectedPrice(e.target.value)
                            }
                          />
                        </Field>
                      </div>
                      <button
                        type="button"
                        className="button button-small"
                        disabled={unitMutation.pending}
                        onClick={async () => {
                          const seatsNum = Math.max(
                            1,
                            Math.min(20, Number(batchSelectedSeats) || 4),
                          );
                          const priceSatang = Math.max(
                            100,
                            Math.round(
                              (Number(batchSelectedPrice) || 2400) * 100,
                            ),
                          );
                          const targetUnitIds = selectedTableUnits.map(
                            (u) => u.id,
                          );
                          try {
                            const res = await unitMutation.run<{
                              updatedCount: number;
                              eventVersion: number;
                            }>(
                              `/api/admin/events/${eventId}/units/batch`,
                              {
                                unitIds: targetUnitIds,
                                priceSatang,
                                admissionCount: seatsNum,
                                reason:
                                  "ปรับที่นั่งและราคาชุดโต๊ะที่เลือกจากหน้าผัง",
                                eventVersion,
                              },
                              "PATCH",
                            );
                            setEventVersion(res.eventVersion);
                            const idSet = new Set(targetUnitIds);
                            setUnits((prev) =>
                              prev.map((u) =>
                                idSet.has(u.id)
                                  ? {
                                      ...u,
                                      priceSatang,
                                      admissionCount: seatsNum,
                                    }
                                  : u,
                              ),
                            );
                            setMessage(
                              `อัปเดตที่นั่ง (${seatsNum} ที่) และราคา (฿${Math.round(priceSatang / 100).toLocaleString("th-TH")}) ให้โต๊ะที่เลือก ${res.updatedCount} โต๊ะเรียบร้อยแล้ว`,
                            );
                            await onEventReload?.();
                          } catch {}
                        }}
                      >
                        <Save size={14} />
                        บันทึกกับ {selectedTableUnits.length} โต๊ะที่เลือก
                      </button>
                    </div>
                  ) : null}

                  <div className="actions">
                    <button
                      type="button"
                      className="button button-outline button-small"
                      onClick={duplicateSelected}
                    >
                      <Copy size={14} />
                      ทำสำเนา ({selectedIds.length})
                    </button>
                    <button
                      type="button"
                      className="button button-danger button-small"
                      onClick={removeSelected}
                    >
                      <Trash2 size={14} />
                      ลบ ({selectedIds.length})
                    </button>
                  </div>
                </div>
              ) : primarySelected ? (
                <>
                  <div className="form-grid">
                    <div className="full">
                      <Field label="รหัส">
                        <input
                          value={primarySelected.code}
                          onChange={(e) =>
                            changeObject(primarySelected.id, {
                              code: e.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <div className="full">
                      <Field
                        label="ชื่อ / ข้อความที่แสดงบนผัง"
                        hint={
                          primarySelected.type !== "table"
                            ? "เช่น STAGE, DJ, ทางเข้า, บาร์น้ำ, ห้องน้ำ"
                            : undefined
                        }
                      >
                        <input
                          value={primarySelected.name}
                          onChange={(e) =>
                            changeObject(primarySelected.id, {
                              name: e.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                    {["table", "seat"].includes(primarySelected.type) ? (
                      <>
                        <div className="full">
                          <Field label="โต๊ะที่ผูกในระบบ">
                            <select
                              value={primarySelected.unitId || ""}
                              onChange={(e) => {
                                const unit = units.find(
                                  (u) => u.id === e.target.value,
                                );
                                changeObject(primarySelected.id, {
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
                              <option value="">เลือกโต๊ะ</option>
                              {units
                                .filter(
                                  (u) =>
                                    u.sellingMode.toLowerCase() ===
                                    primarySelected.type,
                                )
                                .map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.code} · {u.name} ({u.admissionCount} ที่ ·{" "}
                                    ฿
                                    {Math.round(
                                      u.priceSatang / 100,
                                    ).toLocaleString("th-TH")}
                                    )
                                  </option>
                                ))}
                            </select>
                          </Field>
                        </div>
                        {(() => {
                          const linkedUnit = primarySelected.unitId
                            ? units.find((u) => u.id === primarySelected.unitId)
                            : undefined;
                          if (linkedUnit) {
                            const currentSeats =
                              unitDraftSeats[linkedUnit.id] ??
                              String(linkedUnit.admissionCount);
                            const currentPrice =
                              unitDraftPrice[linkedUnit.id] ??
                              String(linkedUnit.priceSatang / 100);
                            return (
                              <div
                                className="full panel stack-sm"
                                style={{ padding: 14 }}
                              >
                                <strong style={{ fontSize: 13 }}>
                                  ตั้งค่าที่นั่งและราคา ({linkedUnit.code})
                                </strong>
                                <div className="form-grid">
                                  <Field label="จำนวนที่นั่งในโต๊ะ">
                                    <input
                                      type="number"
                                      min={1}
                                      max={20}
                                      value={currentSeats}
                                      onChange={(e) =>
                                        setUnitDraftSeats((prev) => ({
                                          ...prev,
                                          [linkedUnit.id]: e.target.value,
                                        }))
                                      }
                                    />
                                  </Field>
                                  <Field label="ราคาโต๊ะ (บาท)">
                                    <input
                                      type="number"
                                      min={1}
                                      step="0.01"
                                      value={currentPrice}
                                      onChange={(e) =>
                                        setUnitDraftPrice((prev) => ({
                                          ...prev,
                                          [linkedUnit.id]: e.target.value,
                                        }))
                                      }
                                    />
                                  </Field>
                                </div>
                                <ErrorNotice error={unitMutation.error} />
                                <button
                                  type="button"
                                  className="button button-small"
                                  disabled={unitMutation.pending}
                                  onClick={async () => {
                                    const seatsNum = Math.max(
                                      1,
                                      Math.min(20, Number(currentSeats) || 4),
                                    );
                                    const priceSatang = Math.max(
                                      100,
                                      Math.round(
                                        (Number(currentPrice) || 0) * 100,
                                      ),
                                    );
                                    try {
                                      const res = await unitMutation.run<{
                                        id: string;
                                        name: string;
                                        priceSatang: number;
                                        admissionCount?: number;
                                        eventVersion: number;
                                      }>(
                                        `/api/admin/events/${eventId}/units/${linkedUnit.id}/price`,
                                        {
                                          name:
                                            primarySelected.name ||
                                            linkedUnit.name,
                                          priceSatang,
                                          admissionCount: seatsNum,
                                          reason:
                                            "อัปเดตจำนวนที่นั่งและราคาโต๊ะจากหน้าแก้ไขผัง",
                                          eventVersion,
                                        },
                                        "PATCH",
                                      );
                                      setEventVersion(res.eventVersion);
                                      setUnits((prev) =>
                                        prev.map((u) =>
                                          u.id === linkedUnit.id
                                            ? {
                                                ...u,
                                                name: res.name,
                                                priceSatang: res.priceSatang,
                                                admissionCount:
                                                  res.admissionCount ??
                                                  seatsNum,
                                              }
                                            : u,
                                        ),
                                      );
                                      setMessage(
                                        `บันทึกที่นั่ง (${seatsNum} ที่) และราคาของโต๊ะ ${linkedUnit.code} แล้ว`,
                                      );
                                      await onEventReload?.();
                                    } catch {}
                                  }}
                                >
                                  <Save size={14} />
                                  {unitMutation.pending
                                    ? "กำลังบันทึก..."
                                    : "บันทึกเฉพาะโต๊ะนี้"}
                                </button>
                                <button
                                  type="button"
                                  className="button button-outline button-small"
                                  disabled={unitMutation.pending}
                                  onClick={async () => {
                                    const seatsNum = Math.max(
                                      1,
                                      Math.min(20, Number(currentSeats) || 4),
                                    );
                                    const priceSatang = Math.max(
                                      100,
                                      Math.round(
                                        (Number(currentPrice) || 0) * 100,
                                      ),
                                    );
                                    try {
                                      const res = await unitMutation.run<{
                                        updatedCount: number;
                                        eventVersion: number;
                                      }>(
                                        `/api/admin/events/${eventId}/units/batch`,
                                        {
                                          priceSatang,
                                          admissionCount: seatsNum,
                                          reason:
                                            "ปรับที่นั่งและราคาทุกโต๊ะจากหน้าแก้ไขผัง",
                                          eventVersion,
                                        },
                                        "PATCH",
                                      );
                                      setEventVersion(res.eventVersion);
                                      setUnits((prev) =>
                                        prev.map((u) => ({
                                          ...u,
                                          priceSatang,
                                          admissionCount: seatsNum,
                                        })),
                                      );
                                      setUnitDraftSeats({});
                                      setUnitDraftPrice({});
                                      setMessage(
                                        `ปรับที่นั่ง (${seatsNum} ที่) และราคา (฿${Math.round(priceSatang / 100).toLocaleString("th-TH")}) ให้ทุกโต๊ะรวม ${res.updatedCount} โต๊ะแล้ว`,
                                      );
                                      await onEventReload?.();
                                    } catch {}
                                  }}
                                >
                                  ใช้ราคานี้กับทุกโต๊ะในงาน
                                </button>
                              </div>
                            );
                          }
                          if (event.status === "DRAFT") {
                            return (
                              <div
                                className="full panel stack-sm"
                                style={{ padding: 14 }}
                              >
                                <strong style={{ fontSize: 13 }}>
                                  สร้างหน่วยขายโต๊ะใหม่สำหรับวัตถุนี้
                                </strong>
                                <div className="form-grid">
                                  <Field label="จำนวนที่นั่งในโต๊ะ">
                                    <input
                                      type="number"
                                      min={1}
                                      max={20}
                                      value={newTableSeats}
                                      onChange={(e) =>
                                        setNewTableSeats(e.target.value)
                                      }
                                    />
                                  </Field>
                                  <Field label="ราคาโต๊ะ (บาท)">
                                    <input
                                      type="number"
                                      min={1}
                                      step="0.01"
                                      value={newTablePrice}
                                      onChange={(e) =>
                                        setNewTablePrice(e.target.value)
                                      }
                                    />
                                  </Field>
                                </div>
                                <ErrorNotice error={unitMutation.error} />
                                <button
                                  type="button"
                                  className="button button-small"
                                  disabled={unitMutation.pending}
                                  onClick={async () => {
                                    const seatsNum = Math.max(
                                      1,
                                      Math.min(20, Number(newTableSeats) || 4),
                                    );
                                    const priceSatang = Math.max(
                                      100,
                                      Math.round(
                                        (Number(newTablePrice) || 2400) * 100,
                                      ),
                                    );
                                    try {
                                      const created =
                                        await unitMutation.run<Unit>(
                                          `/api/admin/events/${eventId}/units`,
                                          {
                                            code: primarySelected.code,
                                            name:
                                              primarySelected.name ||
                                              `โต๊ะ ${primarySelected.code}`,
                                            sellingMode: "TABLE",
                                            admissionCount: seatsNum,
                                            priceSatang,
                                          },
                                          "POST",
                                        );
                                      setEventVersion((v) => v + 1);
                                      setUnits((prev) => [...prev, created]);
                                      changeObject(primarySelected.id, {
                                        unitId: created.id,
                                        zoneId: created.zoneId,
                                        code: created.code,
                                        name: created.name,
                                      });
                                      setMessage(
                                        `สร้างและผูกโต๊ะ ${created.code} (${seatsNum} ที่) เรียบร้อย`,
                                      );
                                      await onEventReload?.();
                                    } catch {}
                                  }}
                                >
                                  <Plus size={14} />
                                  สร้างและผูกโต๊ะนี้
                                </button>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </>
                    ) : null}
                    <Field label="รูปทรง">
                      <select
                        value={primarySelected.shape}
                        onChange={(e) =>
                          changeObject(primarySelected.id, {
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
                            value={primarySelected[key]}
                            min={
                              key === "rotation"
                                ? -360
                                : key === "width" || key === "height"
                                  ? 1
                                  : 0
                            }
                            max={key === "rotation" ? 360 : 10000}
                            onChange={(e) =>
                              changeObject(primarySelected.id, {
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
                      onClick={duplicateSelected}
                    >
                      <Copy size={14} />
                      ทำสำเนา
                    </button>
                    <button
                      className="button button-danger button-small"
                      onClick={removeSelected}
                    >
                      <Trash2 size={14} />
                      ลบ
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted" style={{ fontSize: 12 }}>
                  คลิกเลือกวัตถุ ลากเมาส์คลุมหลายรายการ หรือกด Ctrl+Click
                  เพื่อแก้ไขจัดเรียงเป็นกลุ่ม
                </p>
              )}
              <div style={{ marginTop: 25 }}>
                <h3>ขนาดพื้นที่ผัง</h3>
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
                {layout.geometry.objects.map((o) => {
                  const isSel = selectedIds.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={isSel ? "active" : ""}
                      onClick={(e) =>
                        handleSelectObject(
                          o.id,
                          e.ctrlKey || e.metaKey || e.shiftKey,
                        )
                      }
                    >
                      <span>{o.name || o.code}</span>
                      <span>{typeLabels[o.type]}</span>
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
