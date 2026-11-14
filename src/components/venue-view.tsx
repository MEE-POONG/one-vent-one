"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { Unit, VenueLayout } from "@/lib/client-types";

function TableSeatIcon({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={`venue-unit-icon ${compact ? "is-compact" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 11V6.5A2.5 2.5 0 0 1 9.5 4h5A2.5 2.5 0 0 1 17 6.5V11"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M10 4v7M14 4v7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="11"
        width="14"
        height="3.5"
        rx="1.5"
        fill="currentColor"
      />
      <path
        d="M7.5 14.5V20M16.5 14.5V20M7.5 17.5h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatPriceShort(satang: number) {
  const baht = satang / 100;
  return `฿${new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: satang % 100 ? 2 : 0,
  }).format(baht)}`;
}

export function VenueView({
  layout,
  units = [],
  selected = [],
  onSelect,
  tablesOnly = false,
}: {
  layout: VenueLayout;
  units?: Unit[];
  selected?: string[];
  onSelect?: (id: string) => void;
  tablesOnly?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.75);
  const [zoomOffset, setZoomOffset] = useState(0);

  const recomputeFit = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !layout.width) return;
    const gutter = el.clientWidth < 480 ? 16 : 28;
    const availableWidth = Math.max(180, el.clientWidth - gutter);
    const ratio = availableWidth / layout.width;
    const clamped = Math.min(1.15, Math.max(0.18, Number(ratio.toFixed(3))));
    setFitScale(clamped);
  }, [layout.width]);

  useEffect(() => {
    recomputeFit();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", recomputeFit);
      return () => window.removeEventListener("resize", recomputeFit);
    }
    const observer = new ResizeObserver(() => recomputeFit());
    observer.observe(el);
    return () => observer.disconnect();
  }, [recomputeFit]);

  const zoom = Math.min(1.8, Math.max(0.25, Number((fitScale + zoomOffset).toFixed(3))));
  const inventory = new Map(units.map((unit) => [unit.id, unit]));

  return (
    <div className="venue-view">
      <div className="venue-toolbar">
        <span>ผังสถานที่ · ปรับขนาดพอดีหน้าจออัตโนมัติ</span>
        <button
          type="button"
          className="icon-button venue-fit-btn"
          aria-label="ปรับพอดีหน้าจอ"
          title="ปรับพอดีหน้าจอ (Fit)"
          onClick={() => {
            recomputeFit();
            setZoomOffset(0);
          }}
        >
          <Maximize2 size={14} />
          <span>Fit</span>
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="ย่อผัง"
          onClick={() => setZoomOffset((z) => Math.max(-0.45, Number((z - 0.1).toFixed(2))))}
        >
          <Minus size={16} />
        </button>
        <span className="venue-zoom-readout">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="ขยายผัง"
          onClick={() => setZoomOffset((z) => Math.min(0.85, Number((z + 0.1).toFixed(2))))}
        >
          <Plus size={16} />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="venue-scroll"
        tabIndex={0}
        aria-label="ผังโต๊ะสำหรับเลือกจอง"
      >
        <div
          className="venue-canvas-sizer"
          style={{ width: layout.width * zoom, height: layout.height * zoom }}
        >
          <div
            className="venue-map"
            style={{
              width: layout.width,
              height: layout.height,
              transform: `scale(${zoom})`,
            }}
          >
            {[...layout.geometry.objects]
              .filter((object) =>
                tablesOnly
                  ? ["TABLE", "STAGE", "ENTRANCE", "SERVICE", "LABEL"].includes(
                      object.type.toUpperCase(),
                    )
                  : true,
              )
              .sort(
                (a, b) =>
                  (a.type.toUpperCase() === "ZONE" ? -1 : 0) -
                  (b.type.toUpperCase() === "ZONE" ? -1 : 0),
              )
              .map((object) => {
                const unit = object.unitId
                  ? inventory.get(object.unitId)
                  : undefined;
                const objectType = object.type.toUpperCase();
                const isUnitType = objectType === "TABLE" || objectType === "SEAT";
                const isCompactUnit = object.width < 52 || object.height < 52;
                const rawStatus =
                  unit?.status ||
                  unit?.inventory?.status ||
                  (isUnitType && units.length === 0 ? "AVAILABLE" : undefined);
                const status =
                  rawStatus === "AVAILABLE"
                    ? "AVAILABLE"
                    : rawStatus
                      ? "SOLD"
                      : undefined;
                const selectedUnit = object.unitId
                  ? selected.includes(object.unitId)
                  : false;
                const style: CSSProperties & { "--obj-rot"?: string } = {
                  left: object.x,
                  top: object.y,
                  width: object.width,
                  height: object.height,
                  "--obj-rot": `${object.rotation || 0}deg`,
                  borderRadius: isUnitType
                    ? isCompactUnit
                      ? 9
                      : 13
                    : object.shape === "circle"
                      ? "50%"
                      : 8,
                };

                const unitContent = isUnitType ? (
                  <span
                    className={`venue-unit-inner ${isCompactUnit ? "is-compact" : ""}`}
                  >
                    <TableSeatIcon compact={isCompactUnit} />
                    <strong className="venue-unit-code">
                      {unit?.code || object.code || object.name}
                    </strong>
                    {unit && !isCompactUnit ? (
                      <>
                        <small className="venue-unit-seats">
                          {unit.admissionCount} ที่
                        </small>
                        <span className="venue-unit-price">
                          {formatPriceShort(unit.priceSatang)}
                        </span>
                      </>
                    ) : unit && isCompactUnit ? (
                      <span className="venue-unit-price">
                        {formatPriceShort(unit.priceSatang)}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  object.name || object.label || object.code
                );

                return unit && onSelect ? (
                  <button
                    key={object.id}
                    type="button"
                    className={`venue-object ${isUnitType ? "is-unit-tile" : ""} ${isCompactUnit ? "is-compact-tile" : ""}`}
                    style={style}
                    data-type={objectType}
                    data-status={status}
                    data-selected={selectedUnit}
                    disabled={status !== "AVAILABLE"}
                    aria-label={`${unit.name || unit.code} (${unit.admissionCount} ที่ ${formatPriceShort(unit.priceSatang)}) ${selectedUnit ? "เลือกแล้ว" : ""}`}
                    aria-pressed={selectedUnit}
                    onClick={() => onSelect(unit.id)}
                  >
                    {unitContent}
                  </button>
                ) : (
                  <div
                    key={object.id}
                    className={`venue-object ${isUnitType ? "is-unit-tile" : ""} ${isCompactUnit ? "is-compact-tile" : ""}`}
                    style={style}
                    data-type={objectType}
                    data-status={status}
                  >
                    {unitContent}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
