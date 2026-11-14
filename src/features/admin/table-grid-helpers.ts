import type { LayoutObject } from "@/lib/client-types";

export const snapToGrid = (value: number, step = 10) =>
  step > 1 ? Math.round(value / step) * step : Math.round(value);

export const snap10 = (value: number) => snapToGrid(value, 10);

export function cleanPrefix(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  return cleaned || "T";
}

export function formatTableCode(prefix: string, num: number, pad = 2): string {
  const p = cleanPrefix(prefix);
  return `${p}${String(Math.max(1, num)).padStart(pad, "0")}`;
}

/**
 * Inspects existing unit/object codes matching the given prefix (e.g. "T" -> T01..T24)
 * and returns the next sequential number (e.g. 25).
 */
export function getNextTableSequence(
  existingCodes: Iterable<string>,
  prefix = "T",
): number {
  const p = cleanPrefix(prefix);
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped}0*(\\d+)$`, "i");
  let maxNum = 0;
  for (const code of existingCodes) {
    const match = code.trim().match(regex);
    if (match) {
      const n = Number.parseInt(match[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  return maxNum + 1;
}

/**
 * Generates `count` sequential table unit specs starting from `startNumber`,
 * automatically skipping any code that is already taken.
 */
export function generateTableBatchSpecs({
  prefix = "T",
  startNumber,
  count,
  seats = 4,
  priceBaht = 2400,
  existingCodes = [],
  namePrefix = "โต๊ะ",
}: {
  prefix?: string;
  startNumber?: number;
  count: number;
  seats?: number;
  priceBaht?: number;
  existingCodes?: Iterable<string>;
  namePrefix?: string;
}) {
  const taken = new Set(
    Array.from(existingCodes, (c) => c.trim().toUpperCase()),
  );
  const p = cleanPrefix(prefix);
  let cursor =
    startNumber !== undefined && startNumber >= 1
      ? Math.floor(startNumber)
      : getNextTableSequence(taken, p);
  const safeCount = Math.max(1, Math.min(200, Math.floor(count)));
  const admissionCount = Math.max(1, Math.min(20, Math.round(seats) || 4));
  const priceSatang = Math.max(
    100,
    Math.round((Number(priceBaht) || 2400) * 100),
  );

  const specs: Array<{
    code: string;
    name: string;
    admissionCount: number;
    priceSatang: number;
  }> = [];

  while (specs.length < safeCount) {
    const code = formatTableCode(p, cursor, 2);
    cursor++;
    if (taken.has(code.toUpperCase())) continue;
    taken.add(code.toUpperCase());
    specs.push({
      code,
      name: `${namePrefix} ${code}`.trim(),
      admissionCount,
      priceSatang,
    });
  }

  return specs;
}

export function naturalSortByCode<T extends { code: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.code.localeCompare(b.code, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

/**
 * Calculates centered grid positions for `totalCount` tables arranged into `cols` per row,
 * starting below existing objects (or at `preferredStartY` when arranging all tables).
 */
export function computeTableGridPositions({
  totalCount,
  cols,
  canvasWidth,
  canvasHeight,
  existingObjects = [],
  replaceExistingTables = false,
  tableWidth = 90,
  tableHeight = 70,
  gapX = 20,
  gapY = 20,
}: {
  totalCount: number;
  cols: number;
  canvasWidth: number;
  canvasHeight: number;
  existingObjects?: LayoutObject[];
  replaceExistingTables?: boolean;
  tableWidth?: number;
  tableHeight?: number;
  gapX?: number;
  gapY?: number;
}) {
  const safeCols = Math.max(1, Math.min(20, Math.floor(cols)));
  const rows = Math.max(1, Math.ceil(totalCount / safeCols));

  const gridTotalW = safeCols * tableWidth + (safeCols - 1) * gapX;
  const requiredWidth = Math.max(canvasWidth, snap10(gridTotalW + 120));

  const stageOrHeaderBottom = existingObjects
    .filter(
      (o) =>
        ["stage", "entrance", "service", "label"].includes(o.type) && o.y < 250,
    )
    .reduce((max, o) => Math.max(max, o.y + o.height), 0);

  const existingTablesBottom = replaceExistingTables
    ? 0
    : existingObjects
        .filter((o) => o.type === "table" || o.type === "seat")
        .reduce((max, o) => Math.max(max, o.y + o.height), 0);

  const startY = snap10(
    Math.max(
      140,
      stageOrHeaderBottom ? stageOrHeaderBottom + 40 : 140,
      existingTablesBottom ? existingTablesBottom + 30 : 0,
    ),
  );

  const startX = Math.max(40, snap10((requiredWidth - gridTotalW) / 2));

  const positions: Array<{
    row: number;
    col: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];

  for (let i = 0; i < totalCount; i++) {
    const row = Math.floor(i / safeCols);
    const col = i % safeCols;
    positions.push({
      row,
      col,
      x: snap10(startX + col * (tableWidth + gapX)),
      y: snap10(startY + row * (tableHeight + gapY)),
      width: tableWidth,
      height: tableHeight,
    });
  }

  const lastRowBottom =
    positions.length > 0
      ? positions[positions.length - 1].y + tableHeight
      : startY + tableHeight;
  const requiredHeight = Math.max(canvasHeight, snap10(lastRowBottom + 90));

  return {
    rows,
    cols: safeCols,
    startX,
    startY,
    requiredWidth,
    requiredHeight,
    positions,
  };
}

/**
 * Aligns a set of objects (or all objects) as a single rigid group to the center of the canvas,
 * preserving their relative spacing and positions to one another.
 */
export function alignGroupToCanvasCenter({
  objects,
  targetIds,
  canvasWidth,
  canvasHeight,
  axis = "both",
  gridStep = 10,
}: {
  objects: LayoutObject[];
  targetIds?: string[];
  canvasWidth: number;
  canvasHeight: number;
  axis?: "both" | "horizontal" | "vertical";
  gridStep?: number;
}): LayoutObject[] {
  const targetSet =
    targetIds && targetIds.length > 0
      ? new Set(targetIds)
      : new Set(objects.map((o) => o.id));
  const targets = objects.filter((o) => targetSet.has(o.id));
  if (targets.length === 0) return objects;

  const minX = Math.min(...targets.map((o) => o.x));
  const maxX = Math.max(...targets.map((o) => o.x + o.width));
  const minY = Math.min(...targets.map((o) => o.y));
  const maxY = Math.max(...targets.map((o) => o.y + o.height));

  const groupW = maxX - minX;
  const groupH = maxY - minY;

  const desiredMinX = (canvasWidth - groupW) / 2;
  const desiredMinY = (canvasHeight - groupH) / 2;

  let dx =
    axis === "vertical"
      ? 0
      : snapToGrid(desiredMinX - minX, gridStep);
  let dy =
    axis === "horizontal"
      ? 0
      : snapToGrid(desiredMinY - minY, gridStep);

  // Ensure the group stays within canvas bounds [0, canvasWidth/canvasHeight]
  if (minX + dx < 0) dx = -minX;
  if (maxX + dx > canvasWidth) dx = canvasWidth - maxX;
  if (minY + dy < 0) dy = -minY;
  if (maxY + dy > canvasHeight) dy = canvasHeight - maxY;

  return objects.map((o) =>
    targetSet.has(o.id)
      ? {
          ...o,
          x: Math.max(0, Math.round(o.x + dx)),
          y: Math.max(0, Math.round(o.y + dy)),
        }
      : o,
  );
}

/**
 * Clusters near-aligned rows (Y) and columns (X) of target objects and snaps them
 * onto clean, straight grid coordinates.
 */
export function snapAndStraightenGrid({
  objects,
  targetIds,
  gridStep = 10,
  rowTolerance = 36,
  colTolerance = 44,
}: {
  objects: LayoutObject[];
  targetIds?: string[];
  gridStep?: number;
  rowTolerance?: number;
  colTolerance?: number;
}): LayoutObject[] {
  const targetSet =
    targetIds && targetIds.length > 0
      ? new Set(targetIds)
      : new Set(
          objects.filter((o) => o.type === "table").map((o) => o.id),
        );
  const targets = objects.filter((o) => targetSet.has(o.id));
  if (targets.length === 0) return objects;

  // Cluster Y coordinates (rows)
  const sortedByY = [...targets].sort((a, b) => a.y - b.y);
  const rowClusters: LayoutObject[][] = [];
  for (const obj of sortedByY) {
    const lastCluster = rowClusters[rowClusters.length - 1];
    if (!lastCluster) {
      rowClusters.push([obj]);
    } else {
      const avgY =
        lastCluster.reduce((sum, item) => sum + item.y, 0) / lastCluster.length;
      if (Math.abs(obj.y - avgY) <= rowTolerance) {
        lastCluster.push(obj);
      } else {
        rowClusters.push([obj]);
      }
    }
  }
  const alignedYMap = new Map<string, number>();
  for (const cluster of rowClusters) {
    const avgY =
      cluster.reduce((sum, item) => sum + item.y, 0) / cluster.length;
    const snappedY = Math.max(0, snapToGrid(avgY, gridStep));
    for (const item of cluster) {
      alignedYMap.set(item.id, snappedY);
    }
  }

  // Cluster X coordinates (columns)
  const sortedByX = [...targets].sort((a, b) => a.x - b.x);
  const colClusters: LayoutObject[][] = [];
  for (const obj of sortedByX) {
    const lastCluster = colClusters[colClusters.length - 1];
    if (!lastCluster) {
      colClusters.push([obj]);
    } else {
      const avgX =
        lastCluster.reduce((sum, item) => sum + item.x, 0) / lastCluster.length;
      if (Math.abs(obj.x - avgX) <= colTolerance) {
        lastCluster.push(obj);
      } else {
        colClusters.push([obj]);
      }
    }
  }
  const alignedXMap = new Map<string, number>();
  for (const cluster of colClusters) {
    const avgX =
      cluster.reduce((sum, item) => sum + item.x, 0) / cluster.length;
    const snappedX = Math.max(0, snapToGrid(avgX, gridStep));
    for (const item of cluster) {
      alignedXMap.set(item.id, snappedX);
    }
  }

  return objects.map((o) => {
    if (!targetSet.has(o.id)) return o;
    return {
      ...o,
      x: alignedXMap.get(o.id) ?? snapToGrid(o.x, gridStep),
      y: alignedYMap.get(o.id) ?? snapToGrid(o.y, gridStep),
    };
  });
}

export function alignSelectedObjects({
  objects,
  selectedIds,
  mode,
  gridStep = 10,
}: {
  objects: LayoutObject[];
  selectedIds: string[];
  mode:
    | "left"
    | "center-h"
    | "right"
    | "top"
    | "center-v"
    | "bottom"
    | "distribute-h"
    | "distribute-v";
  gridStep?: number;
}): LayoutObject[] {
  const selectedSet = new Set(selectedIds);
  const targets = objects.filter((o) => selectedSet.has(o.id));
  if (targets.length < 2) return objects;

  const minX = Math.min(...targets.map((o) => o.x));
  const maxX = Math.max(...targets.map((o) => o.x + o.width));
  const minY = Math.min(...targets.map((o) => o.y));
  const maxY = Math.max(...targets.map((o) => o.y + o.height));
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  if (mode === "distribute-h" && targets.length >= 3) {
    const sorted = [...targets].sort((a, b) => a.x - b.x);
    const totalWidths = sorted.reduce((s, o) => s + o.width, 0);
    const gap = (maxX - minX - totalWidths) / (sorted.length - 1);
    let cursor = minX;
    const xMap = new Map<string, number>();
    for (const o of sorted) {
      xMap.set(o.id, Math.max(0, snapToGrid(cursor, gridStep)));
      cursor += o.width + gap;
    }
    return objects.map((o) =>
      xMap.has(o.id) ? { ...o, x: xMap.get(o.id)! } : o,
    );
  }

  if (mode === "distribute-v" && targets.length >= 3) {
    const sorted = [...targets].sort((a, b) => a.y - b.y);
    const totalHeights = sorted.reduce((s, o) => s + o.height, 0);
    const gap = (maxY - minY - totalHeights) / (sorted.length - 1);
    let cursor = minY;
    const yMap = new Map<string, number>();
    for (const o of sorted) {
      yMap.set(o.id, Math.max(0, snapToGrid(cursor, gridStep)));
      cursor += o.height + gap;
    }
    return objects.map((o) =>
      yMap.has(o.id) ? { ...o, y: yMap.get(o.id)! } : o,
    );
  }

  return objects.map((o) => {
    if (!selectedSet.has(o.id)) return o;
    if (mode === "left") return { ...o, x: snapToGrid(minX, gridStep) };
    if (mode === "center-h")
      return { ...o, x: Math.max(0, snapToGrid(midX - o.width / 2, gridStep)) };
    if (mode === "right")
      return { ...o, x: Math.max(0, snapToGrid(maxX - o.width, gridStep)) };
    if (mode === "top") return { ...o, y: snapToGrid(minY, gridStep) };
    if (mode === "center-v")
      return { ...o, y: Math.max(0, snapToGrid(midY - o.height / 2, gridStep)) };
    if (mode === "bottom")
      return { ...o, y: Math.max(0, snapToGrid(maxY - o.height, gridStep)) };
    return o;
  });
}

export function getLastTableDefaults(
  units: ReadonlyArray<{
    code: string;
    sellingMode: string;
    admissionCount: number;
    priceSatang: number;
    zoneId?: string;
  }>,
) {
  const tables = units.filter((u) => u.sellingMode === "TABLE");
  const last = tables[tables.length - 1];
  const prefixMatch = last?.code.match(/^([A-Za-z_-]+)/);
  return {
    prefix: prefixMatch?.[1]?.toUpperCase() || "T",
    seats: last?.admissionCount ?? 4,
    priceBaht: last ? Math.round(last.priceSatang / 100) : 2400,
    zoneId: last?.zoneId || "",
  };
}
