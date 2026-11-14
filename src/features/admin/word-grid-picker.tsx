"use client";
import { useState } from "react";
import { Grid3X3 } from "lucide-react";

export function WordGridPicker({
  rows,
  cols,
  maxRows = 8,
  maxCols = 10,
  onSelect,
  onInstantCommit,
  instantLabel = "คลิกช่องตารางเพื่อสร้างและวางทันที",
  defaultInstant = false,
  disabled = false,
  codePreview,
}: {
  rows: number;
  cols: number;
  maxRows?: number;
  maxCols?: number;
  onSelect: (rows: number, cols: number) => void;
  onInstantCommit?: (rows: number, cols: number) => void;
  instantLabel?: string;
  defaultInstant?: boolean;
  disabled?: boolean;
  codePreview?: string;
}) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [instant, setInstant] = useState(defaultInstant);

  const activeRows = hover?.r ?? rows;
  const activeCols = hover?.c ?? cols;
  const total = activeRows * activeCols;

  return (
    <div className="word-grid-picker">
      <div className="word-grid-header">
        <div className="word-grid-title">
          <Grid3X3 size={15} />
          <strong>
            {activeRows} แถว × {activeCols} โต๊ะ/แถว{" "}
            <span className="word-grid-badge">รวม {total} โต๊ะ</span>
          </strong>
        </div>
        {codePreview ? (
          <small className="word-grid-code-preview">{codePreview}</small>
        ) : null}
      </div>

      <div
        className="word-grid-matrix"
        style={{
          gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))`,
        }}
        onMouseLeave={() => setHover(null)}
        role="grid"
        aria-label="เลือกจำนวนแถวและจำนวนโต๊ะต่อแถว"
      >
        {Array.from({ length: maxRows }, (_, rIdx) => {
          const r = rIdx + 1;
          return Array.from({ length: maxCols }, (__, cIdx) => {
            const c = cIdx + 1;
            const highlighted = r <= activeRows && c <= activeCols;
            const isSelectedCorner = r === rows && c === cols && !hover;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={disabled}
                className={`word-grid-cell${highlighted ? " active" : ""}${isSelectedCorner ? " corner" : ""}`}
                title={`${r} แถว × ${c} โต๊ะ/แถว (${r * c} โต๊ะ)`}
                onMouseEnter={() => setHover({ r, c })}
                onFocus={() => setHover({ r, c })}
                onClick={() => {
                  onSelect(r, c);
                  if (instant && onInstantCommit) {
                    onInstantCommit(r, c);
                  }
                }}
              />
            );
          });
        })}
      </div>

      <div className="word-grid-controls">
        <label className="word-grid-num">
          <span>จำนวนแถว</span>
          <input
            type="number"
            min={1}
            max={20}
            disabled={disabled}
            value={rows}
            onChange={(e) => {
              const nextR = Math.max(1, Math.min(20, Number(e.target.value) || 1));
              onSelect(nextR, cols);
            }}
          />
        </label>
        <span className="word-grid-mul">×</span>
        <label className="word-grid-num">
          <span>โต๊ะต่อแถว</span>
          <input
            type="number"
            min={1}
            max={20}
            disabled={disabled}
            value={cols}
            onChange={(e) => {
              const nextC = Math.max(1, Math.min(20, Number(e.target.value) || 1));
              onSelect(rows, nextC);
            }}
          />
        </label>
        <div className="word-grid-QuickPresets">
          {[
            [2, 5],
            [3, 6],
            [4, 6],
            [5, 6],
            [4, 8],
          ].map(([pr, pc]) => (
            <button
              key={`${pr}x${pc}`}
              type="button"
              disabled={disabled}
              className={`word-grid-preset${rows === pr && cols === pc ? " active" : ""}`}
              onClick={() => onSelect(pr, pc)}
            >
              {pr}×{pc}
            </button>
          ))}
        </div>
      </div>

      {onInstantCommit ? (
        <label className="check-label word-grid-instant">
          <input
            type="checkbox"
            checked={instant}
            onChange={(e) => setInstant(e.target.checked)}
          />
          <span>{instantLabel}</span>
        </label>
      ) : null}
    </div>
  );
}

