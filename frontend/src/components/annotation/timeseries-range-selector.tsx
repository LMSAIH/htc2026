/**
 * Timeseries Range Selector
 *
 * Displays a simulated chart and allows annotators to select
 * ranges and tag them with event types.
 * Based on Label Studio time-series annotation patterns.
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Undo2, RotateCcw } from "lucide-react";
import type { LabelOption } from "@/lib/annotation-tasks";

export interface TSRange {
  id: string;
  labelId: string;
  startPct: number;
  endPct: number;
  notes?: string;
}

interface TimeseriesRangeSelectorProps {
  filename: string;
  labels: LabelOption[];
  value: TSRange[];
  onChange: (ranges: TSRange[]) => void;
}

export function TimeseriesRangeSelector({
  filename,
  labels,
  value,
  onChange,
}: TimeseriesRangeSelectorProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [activeLabel, setActiveLabel] = useState<LabelOption>(labels[0]);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);

  // Simulated data points
  const [dataPoints] = useState(() =>
    Array.from({ length: 100 }, (_, i) => {
      const base = 50 + 20 * Math.sin(i / 8) + 10 * Math.cos(i / 3);
      const noise = (Math.random() - 0.5) * 15;
      const spike = i > 60 && i < 70 ? 30 : 0;
      return Math.max(5, Math.min(95, base + noise + spike));
    }),
  );

  const getPct = useCallback(
    (e: React.MouseEvent) => {
      const rect = chartRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pct = getPct(e);
      setDragging(true);
      setDragStart(pct);
      setDragEnd(pct);
    },
    [getPct],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      setDragEnd(getPct(e));
    },
    [dragging, getPct],
  );

  const handleMouseUp = useCallback(() => {
    if (!dragging || dragStart === null || dragEnd === null) {
      setDragging(false);
      return;
    }

    const start = Math.min(dragStart, dragEnd);
    const end = Math.max(dragStart, dragEnd);

    if (end - start > 2) {
      const newRange: TSRange = {
        id: `tsr_${Date.now()}`,
        labelId: activeLabel.id,
        startPct: start,
        endPct: end,
      };
      onChange([...value, newRange]);
    }

    setDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [dragging, dragStart, dragEnd, activeLabel, value, onChange]);

  const removeRange = (id: string) => {
    onChange(value.filter((r) => r.id !== id));
  };

  const undoLast = () => {
    if (value.length > 0) onChange(value.slice(0, -1));
  };

  const clearAll = () => onChange([]);

  const drawRange =
    dragging && dragStart !== null && dragEnd !== null
      ? { start: Math.min(dragStart, dragEnd), end: Math.max(dragStart, dragEnd) }
      : null;

  return (
    <div className="space-y-3">
      {/* Label selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Label:</span>
        {labels.map((lbl) => (
          <button
            key={lbl.id}
            onClick={() => setActiveLabel(lbl)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-all ${
              activeLabel.id === lbl.id
                ? "border-foreground bg-foreground/5 font-medium"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: lbl.color }}
            />
            {lbl.label}
          </button>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={undoLast} disabled={value.length === 0}>
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearAll} disabled={value.length === 0}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Chart area */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/20 flex items-center gap-2">
          <span className="text-[11px] font-mono text-muted-foreground truncate">
            {filename}
          </span>
          <span className="text-[11px] text-muted-foreground">
            · {dataPoints.length} data points
          </span>
        </div>

        <div
          ref={chartRef}
          className="relative h-48 cursor-crosshair select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (dragging) {
              setDragging(false);
              setDragStart(null);
              setDragEnd(null);
            }
          }}
        >
          {/* Grid lines */}
          {[25, 50, 75].map((y) => (
            <div
              key={y}
              className="absolute inset-x-0 border-t border-dashed border-muted-foreground/10"
              style={{ top: `${y}%` }}
            />
          ))}

          {/* Data line (SVG) */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinejoin="round"
              points={dataPoints
                .map(
                  (v, i) =>
                    `${(i / (dataPoints.length - 1)) * 100}%,${100 - v}%`,
                )
                .join(" ")}
            />
            {/* Area under curve */}
            <polygon
              fill="var(--primary)"
              opacity="0.08"
              points={`0%,100% ${dataPoints
                .map(
                  (v, i) =>
                    `${(i / (dataPoints.length - 1)) * 100}%,${100 - v}%`,
                )
                .join(" ")} 100%,100%`}
            />
          </svg>

          {/* Existing ranges */}
          {value.map((range) => {
            const lbl = labels.find((l) => l.id === range.labelId);
            return (
              <div
                key={range.id}
                className="absolute top-0 bottom-0 cursor-pointer group"
                style={{
                  left: `${range.startPct}%`,
                  width: `${range.endPct - range.startPct}%`,
                  backgroundColor: `${lbl?.color ?? "#666"}20`,
                  borderLeft: `2px solid ${lbl?.color ?? "#666"}`,
                  borderRight: `2px solid ${lbl?.color ?? "#666"}`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  removeRange(range.id);
                }}
              >
                <div
                  className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap"
                  style={{ backgroundColor: lbl?.color ?? "#666" }}
                >
                  {lbl?.label}
                </div>
              </div>
            );
          })}

          {/* Drawing preview */}
          {drawRange && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: `${drawRange.start}%`,
                width: `${drawRange.end - drawRange.start}%`,
                backgroundColor: `${activeLabel.color ?? "#666"}25`,
                borderLeft: `2px dashed ${activeLabel.color}`,
                borderRight: `2px dashed ${activeLabel.color}`,
              }}
            />
          )}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between px-3 py-1 border-t bg-muted/10 text-[10px] text-muted-foreground">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      {/* Instruction */}
      <p className="text-[11px] text-muted-foreground">
        Click and drag on the chart to select a time range. Click an existing
        range to remove it.
      </p>

      {/* Range list */}
      {value.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {value.length} range{value.length !== 1 ? "s" : ""} annotated
          </span>
          <div className="flex flex-wrap gap-1.5">
            {value.map((range) => {
              const lbl = labels.find((l) => l.id === range.labelId);
              return (
                <Badge
                  key={range.id}
                  variant="outline"
                  className="text-[11px] gap-1"
                  style={{ borderColor: lbl?.color, color: lbl?.color }}
                >
                  <div
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: lbl?.color }}
                  />
                  {lbl?.label}: {Math.round(range.startPct)}%–{Math.round(range.endPct)}%
                  <button
                    onClick={() => removeRange(range.id)}
                    className="ml-0.5 hover:text-red-500"
                  >
                    ×
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
