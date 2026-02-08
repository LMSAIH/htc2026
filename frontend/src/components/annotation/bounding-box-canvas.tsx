/**
 * Bounding Box Annotation Canvas
 *
 * Allows annotators to draw and manage bounding boxes on images.
 * Modeled after CVAT / Labelbox / Label Studio bbox tools.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  MousePointer,
  Square,
  Undo2,
  RotateCcw,
} from "lucide-react";
import type { DrawingClass } from "@/lib/annotation-tasks";

export interface BBox {
  id: string;
  classId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BoundingBoxCanvasProps {
  /** URL or placeholder for the image */
  imageSrc?: string;
  /** Fallback content when no real image */
  filename: string;
  classes: DrawingClass[];
  value: BBox[];
  onChange: (boxes: BBox[]) => void;
}

export function BoundingBoxCanvas({
  imageSrc,
  filename,
  classes,
  value,
  onChange,
}: BoundingBoxCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [activeClass, setActiveClass] = useState<DrawingClass>(classes[0]);
  const [mode, setMode] = useState<"draw" | "select">("draw");
  const [selectedBox, setSelectedBox] = useState<string | null>(null);

  const getRelativePos = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      };
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== "draw") return;
      const pos = getRelativePos(e);
      setStartPos(pos);
      setCurrentPos(pos);
      setDrawing(true);
    },
    [mode, getRelativePos],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing) return;
      setCurrentPos(getRelativePos(e));
    },
    [drawing, getRelativePos],
  );

  const handleMouseUp = useCallback(() => {
    if (!drawing || !startPos || !currentPos) {
      setDrawing(false);
      return;
    }

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    // Only create box if it's big enough (>2% on either dimension)
    if (width > 2 && height > 2) {
      const newBox: BBox = {
        id: `bbox_${Date.now()}`,
        classId: activeClass.id,
        x,
        y,
        width,
        height,
      };
      onChange([...value, newBox]);
    }

    setDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
  }, [drawing, startPos, currentPos, activeClass, value, onChange]);

  const removeBox = (id: string) => {
    onChange(value.filter((b) => b.id !== id));
    setSelectedBox(null);
  };

  const undoLast = () => {
    if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const clearAll = () => {
    onChange([]);
    setSelectedBox(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undoLast();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedBox) {
          removeBox(selectedBox);
        }
      }
      if (e.key === "v") setMode("select");
      if (e.key === "b") setMode("draw");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const drawRect =
    drawing && startPos && currentPos
      ? {
          x: Math.min(startPos.x, currentPos.x),
          y: Math.min(startPos.y, currentPos.y),
          width: Math.abs(currentPos.x - startPos.x),
          height: Math.abs(currentPos.y - startPos.y),
        }
      : null;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant={mode === "select" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 gap-1 text-xs"
            onClick={() => setMode("select")}
          >
            <MousePointer className="h-3 w-3" />
            Select
            <kbd className="ml-1 text-[10px] text-muted-foreground">V</kbd>
          </Button>
          <Button
            variant={mode === "draw" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 gap-1 text-xs"
            onClick={() => setMode("draw")}
          >
            <Square className="h-3 w-3" />
            Draw
            <kbd className="ml-1 text-[10px] text-muted-foreground">B</kbd>
          </Button>
        </div>

        <div className="h-4 border-l" />

        {/* Class selector */}
        <div className="flex items-center gap-1">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setActiveClass(cls)}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all ${
                activeClass.id === cls.id
                  ? "border-foreground bg-foreground/5 font-medium"
                  : "border-border hover:border-foreground/30"
              }`}
            >
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: cls.color }}
              />
              {cls.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={undoLast} disabled={value.length === 0}>
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearAll} disabled={value.length === 0}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`relative rounded-lg border-2 overflow-hidden bg-muted/30 aspect-[4/3] ${
          mode === "draw" ? "cursor-crosshair" : "cursor-default"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (drawing) {
            setDrawing(false);
            setStartPos(null);
            setCurrentPos(null);
          }
        }}
      >
        {/* Placeholder image */}
        {imageSrc ? (
          <img src={imageSrc} alt={filename} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/40 dark:to-slate-700/40 flex flex-col items-center justify-center text-muted-foreground">
            <Square className="h-12 w-12 opacity-20 mb-2" />
            <span className="text-sm font-mono opacity-50">{filename}</span>
          </div>
        )}

        {/* Existing boxes */}
        {value.map((box) => {
          const cls = classes.find((c) => c.id === box.classId);
          const isSelected = selectedBox === box.id;
          return (
            <div
              key={box.id}
              className={`absolute border-2 transition-shadow ${
                isSelected ? "shadow-lg" : ""
              }`}
              style={{
                left: `${box.x}%`,
                top: `${box.y}%`,
                width: `${box.width}%`,
                height: `${box.height}%`,
                borderColor: cls?.color ?? "#666",
                backgroundColor: `${cls?.color ?? "#666"}15`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (mode === "select") setSelectedBox(box.id);
              }}
            >
              {/* Label badge */}
              <div
                className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap flex items-center gap-1"
                style={{ backgroundColor: cls?.color ?? "#666" }}
              >
                {cls?.label}
                {isSelected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBox(box.id);
                    }}
                    className="hover:text-red-200 transition-colors"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
              {/* Resize handles (visual only) */}
              {isSelected && (
                <>
                  <div className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-white border-2" style={{ borderColor: cls?.color }} />
                  <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-white border-2" style={{ borderColor: cls?.color }} />
                  <div className="absolute -bottom-1 -left-1 h-2.5 w-2.5 rounded-full bg-white border-2" style={{ borderColor: cls?.color }} />
                  <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-white border-2" style={{ borderColor: cls?.color }} />
                </>
              )}
            </div>
          );
        })}

        {/* Drawing preview */}
        {drawRect && (
          <div
            className="absolute border-2 border-dashed pointer-events-none"
            style={{
              left: `${drawRect.x}%`,
              top: `${drawRect.y}%`,
              width: `${drawRect.width}%`,
              height: `${drawRect.height}%`,
              borderColor: activeClass.color,
              backgroundColor: `${activeClass.color}15`,
            }}
          />
        )}
      </div>

      {/* Box list */}
      {value.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {value.length} annotation{value.length !== 1 ? "s" : ""}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {value.map((box) => {
              const cls = classes.find((c) => c.id === box.classId);
              return (
                <Badge
                  key={box.id}
                  variant="outline"
                  className="text-[11px] gap-1 cursor-pointer"
                  style={{
                    borderColor: cls?.color,
                    color: cls?.color,
                  }}
                  onClick={() => setSelectedBox(box.id)}
                >
                  <div
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: cls?.color }}
                  />
                  {cls?.label}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBox(box.id);
                    }}
                    className="ml-0.5 hover:text-red-500 transition-colors"
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
