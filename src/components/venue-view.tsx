"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { Pool, TicketType, Unit, VenueLayout, Zone } from "@/lib/client-types";

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
      <rect x="5" y="11" width="14" height="3.5" rx="1.5" fill="currentColor" />
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
  zones = [],
  ticketTypes = [],
  pools = [],
  selectedQuantities = {},
  onChangeZoneQuantity,
  tablesOnly = false,
}: {
  layout: VenueLayout;
  units?: Unit[];
  selected?: string[];
  onSelect?: (id: string) => void;
  zones?: Zone[];
  ticketTypes?: TicketType[];
  pools?: Pool[];
  selectedQuantities?: Record<string, number>;
  onChangeZoneQuantity?: (ticketTypeId: string, nextQuantity: number) => void;
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

  const zoom = Math.min(
    1.8,
    Math.max(0.25, Number((fitScale + zoomOffset).toFixed(3))),
  );
  const inventory = new Map(units.map((unit) => [unit.id, unit]));
  const zoneMap = new Map(zones.map((zone) => [zone.id, zone]));
  const poolMap = new Map(pools.map((pool) => [pool.id, pool]));

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
          onClick={() =>
            setZoomOffset((z) => Math.max(-0.45, Number((z - 0.1).toFixed(2))))
          }
        >
          <Minus size={16} />
        </button>
        <span className="venue-zoom-readout">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="icon-button"
          aria-label="ขยายผัง"
          onClick={() =>
            setZoomOffset((z) => Math.min(0.85, Number((z + 0.1).toFixed(2))))
          }
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
                const isUnitType =
                  objectType === "TABLE" || objectType === "SEAT";
                const isZoneType = objectType === "ZONE";
                const zone = isZoneType
                  ? (object.zoneId ? zoneMap.get(object.zoneId) : undefined) ??
                    zones.find(
                      (z) =>
                        z.name === object.name ||
                        z.code === object.code ||
                        `ZONE-${z.code}` === object.code,
                    )
                  : undefined;
                const resolvedZoneId = object.zoneId || zone?.id;
                const zoneTicket =
                  isZoneType && resolvedZoneId
                    ? ticketTypes.find(
                        (t) =>
                          t.zoneId === resolvedZoneId && t.active !== false,
                      ) ?? zone?.ticketTypes?.[0]
                    : undefined;
                if (
                  isZoneType &&
                  zone?.sellingMode === "TABLE" &&
                  !zoneTicket
                ) {
                  return null;
                }
                const zonePool = zoneTicket
                  ? poolMap.get(zoneTicket.poolId) ??
                    pools.find((p) => p.zoneId === resolvedZoneId) ??
                    zone?.pools?.[0]
                  : isZoneType && resolvedZoneId
                    ? pools.find((p) => p.zoneId === resolvedZoneId) ??
                      zone?.pools?.[0]
                    : undefined;
                const zoneAvailable =
                  zonePool?.available ?? zone?.capacity ?? 0;
                const zoneQty = zoneTicket
                  ? selectedQuantities[zoneTicket.id] || 0
                  : 0;
                const zoneMax = Math.min(20, Math.max(0, zoneAvailable));
                const isBookableZone = isZoneType && Boolean(zoneTicket);

                const isCompactUnit = object.width < 52 || object.height < 52;
                const rawStatus = isBookableZone
                  ? zoneAvailable > 0 || zoneQty > 0
                    ? "AVAILABLE"
                    : "SOLD"
                  : unit?.status ||
                    unit?.inventory?.status ||
                    (isUnitType && units.length === 0 ? "AVAILABLE" : undefined);
                const status =
                  rawStatus === "AVAILABLE"
                    ? "AVAILABLE"
                    : rawStatus
                      ? "SOLD"
                      : undefined;
                const selectedUnit = isBookableZone
                  ? zoneQty > 0
                  : object.unitId
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
                      : 13,
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
                ) : isZoneType ? (
                  <span className="venue-zone-inner">
                    <strong className="venue-zone-name">
                      {zone?.name || object.name || object.label || object.code}
                    </strong>
                    {zoneTicket ? (
                      <span className="venue-zone-price">
                        {formatPriceShort(zoneTicket.priceSatang)} / ใบ
                      </span>
                    ) : null}
                    {isBookableZone ? (
                      <small className="venue-zone-stock">
                        {zoneAvailable > 0
                          ? `คงเหลือ ${zoneAvailable} ใบ`
                          : "บัตรเต็มแล้ว"}
                      </small>
                    ) : null}
                    {onChangeZoneQuantity && zoneTicket && zoneQty > 0 ? (
                      <span
                        className="venue-zone-stepper"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          role="button"
                          tabIndex={0}
                          className="venue-zone-step-btn"
                          aria-label="ลดจำนวนบัตรโซน"
                          onClick={(e) => {
                            e.stopPropagation();
                            onChangeZoneQuantity(
                              zoneTicket.id,
                              Math.max(0, zoneQty - 1),
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              onChangeZoneQuantity(
                                zoneTicket.id,
                                Math.max(0, zoneQty - 1),
                              );
                            }
                          }}
                        >
                          −
                        </span>
                        <select
                          className="venue-zone-select"
                          aria-label="เลือกจำนวนบัตรในโซน"
                          value={zoneQty}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            onChangeZoneQuantity(
                              zoneTicket.id,
                              Number(e.target.value),
                            );
                          }}
                        >
                          <option value={0}>0 ใบ (ยกเลิก)</option>
                          {Array.from(
                            { length: Math.max(zoneMax, zoneQty) },
                            (_, idx) => idx + 1,
                          ).map((n) => (
                            <option key={n} value={n} disabled={n > zoneMax}>
                              เลือก {n} ใบ
                            </option>
                          ))}
                        </select>
                        <span
                          role="button"
                          tabIndex={0}
                          className={`venue-zone-step-btn ${zoneQty >= zoneMax ? "is-disabled" : ""}`}
                          aria-label="เพิ่มจำนวนบัตรโซน"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (zoneQty < zoneMax) {
                              onChangeZoneQuantity(zoneTicket.id, zoneQty + 1);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (
                              (e.key === "Enter" || e.key === " ") &&
                              zoneQty < zoneMax
                            ) {
                              e.preventDefault();
                              e.stopPropagation();
                              onChangeZoneQuantity(zoneTicket.id, zoneQty + 1);
                            }
                          }}
                        >
                          +
                        </span>
                      </span>
                    ) : onChangeZoneQuantity &&
                      zoneTicket &&
                      zoneAvailable > 0 ? (
                      <span className="venue-zone-cta">คลิกเพื่อเลือกโซนนี้</span>
                    ) : null}
                  </span>
                ) : (
                  object.name || object.label || object.code
                );

                if (isBookableZone && zoneTicket && onChangeZoneQuantity) {
                  return (
                    <button
                      key={object.id}
                      type="button"
                      className="venue-object is-zone-tile"
                      style={style}
                      data-type="ZONE"
                      data-status={status}
                      data-selected={selectedUnit}
                      disabled={status !== "AVAILABLE"}
                      aria-label={`${object.name || zone?.name || zoneTicket.name} (${formatPriceShort(zoneTicket.priceSatang)} / ใบ) ${selectedUnit ? `เลือกแล้ว ${zoneQty} ใบ` : ""}`}
                      aria-pressed={selectedUnit}
                      onClick={() =>
                        onChangeZoneQuantity(
                          zoneTicket.id,
                          zoneQty > 0 ? 0 : 1,
                        )
                      }
                    >
                      {unitContent}
                    </button>
                  );
                }

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
                    className={`venue-object ${isUnitType ? "is-unit-tile" : ""} ${isZoneType ? "is-zone-tile" : ""} ${isCompactUnit ? "is-compact-tile" : ""}`}
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
