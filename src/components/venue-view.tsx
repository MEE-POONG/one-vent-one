"use client";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Unit, VenueLayout } from "@/lib/client-types";
export function VenueView({
  layout,
  units = [],
  selected = [],
  onSelect,
}: {
  layout: VenueLayout;
  units?: Unit[];
  selected?: string[];
  onSelect?: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(0.7);
  const inventory = new Map(units.map((unit) => [unit.id, unit]));
  return (
    <div className="venue-view">
      <div className="venue-toolbar">
        <span>ผังสถานที่ · เลื่อนเพื่อดูพื้นที่ทั้งหมด</span>
        <button
          type="button"
          className="icon-button"
          aria-label="ย่อผัง"
          onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
        >
          <Minus size={16} />
        </button>
        <span style={{ margin: 0, minWidth: 40, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="ขยายผัง"
          onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
        >
          <Plus size={16} />
        </button>
      </div>
      <div
        className="venue-scroll"
        tabIndex={0}
        aria-label="ผังโต๊ะและที่นั่ง เลือกจากรายการข้อความด้านล่างได้"
      >
        <div
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
              .sort(
                (a, b) =>
                  (a.type.toUpperCase() === "ZONE" ? -1 : 0) -
                  (b.type.toUpperCase() === "ZONE" ? -1 : 0),
              )
              .map((object) => {
                const unit = object.unitId
                  ? inventory.get(object.unitId)
                  : undefined;
                const status = unit?.status || unit?.inventory?.status;
                const selectedUnit = object.unitId
                  ? selected.includes(object.unitId)
                  : false;
                const style = {
                  left: object.x,
                  top: object.y,
                  width: object.width,
                  height: object.height,
                  transform: `rotate(${object.rotation}deg)`,
                  borderRadius: object.shape === "circle" ? "50%" : 6,
                };
                return unit && onSelect ? (
                  <button
                    key={object.id}
                    type="button"
                    className="venue-object"
                    style={style}
                    data-type={object.type.toUpperCase()}
                    data-status={status}
                    data-selected={selectedUnit}
                    disabled={status !== "AVAILABLE"}
                    aria-label={`${unit.name || unit.code} ${selectedUnit ? "เลือกแล้ว" : ""}`}
                    aria-pressed={selectedUnit}
                    onClick={() => onSelect(unit.id)}
                  >
                    {object.code || object.name}
                  </button>
                ) : (
                  <div
                    key={object.id}
                    className="venue-object"
                    style={style}
                    data-type={object.type.toUpperCase()}
                  >
                    {object.name || object.label || object.code}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
