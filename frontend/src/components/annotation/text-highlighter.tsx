/**
 * Text Entity Highlighter (NER Annotation)
 *
 * Allows annotators to select text spans and tag them with entity types.
 * Based on Label Studio / Prodigy NER annotation patterns.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Undo2, RotateCcw } from "lucide-react";
import type { EntityType } from "@/lib/annotation-tasks";

export interface TextSpan {
  id: string;
  entityTypeId: string;
  startOffset: number;
  endOffset: number;
  text: string;
}

interface TextHighlighterProps {
  /** The text content to annotate */
  text: string;
  entityTypes: EntityType[];
  value: TextSpan[];
  onChange: (spans: TextSpan[]) => void;
}

export function TextHighlighter({
  text,
  entityTypes,
  value,
  onChange,
}: TextHighlighterProps) {
  const [activeType, setActiveType] = useState<EntityType>(entityTypes[0]);

  const handleTextSelect = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const container = document.getElementById("ner-text-container");
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    // Calculate offsets within the text
    const selectedText = sel.toString().trim();
    if (!selectedText) return;

    const startOffset = text.indexOf(selectedText);
    if (startOffset === -1) return;
    const endOffset = startOffset + selectedText.length;

    // Check for overlaps with existing spans
    const overlaps = value.some(
      (s) =>
        (startOffset >= s.startOffset && startOffset < s.endOffset) ||
        (endOffset > s.startOffset && endOffset <= s.endOffset) ||
        (startOffset <= s.startOffset && endOffset >= s.endOffset),
    );

    if (!overlaps) {
      const newSpan: TextSpan = {
        id: `span_${Date.now()}`,
        entityTypeId: activeType.id,
        startOffset,
        endOffset,
        text: selectedText,
      };
      onChange([...value, newSpan]);
    }

    sel.removeAllRanges();
  }, [text, activeType, value, onChange]);

  const removeSpan = (id: string) => {
    onChange(value.filter((s) => s.id !== id));
  };

  const undoLast = () => {
    if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const clearAll = () => onChange([]);

  // Build annotated text with highlights
  const renderAnnotatedText = () => {
    if (value.length === 0) {
      return <span>{text}</span>;
    }

    const sorted = [...value].sort((a, b) => a.startOffset - b.startOffset);
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const span of sorted) {
      // Text before this span
      if (span.startOffset > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.slice(lastIndex, span.startOffset)}
          </span>,
        );
      }

      // The highlighted span
      const entityType = entityTypes.find((e) => e.id === span.entityTypeId);
      parts.push(
        <mark
          key={span.id}
          className="relative rounded px-0.5 mx-px cursor-pointer group"
          style={{
            backgroundColor: `${entityType?.color ?? "#666"}25`,
            borderBottom: `2px solid ${entityType?.color ?? "#666"}`,
          }}
          title={entityType?.label}
          onClick={(e) => {
            e.preventDefault();
            removeSpan(span.id);
          }}
        >
          {span.text}
          <span
            className="absolute -top-5 left-0 px-1 py-0.5 rounded text-[9px] font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
            style={{ backgroundColor: entityType?.color ?? "#666" }}
          >
            {entityType?.label} ×
          </span>
        </mark>,
      );

      lastIndex = span.endOffset;
    }

    // Remaining text
    if (lastIndex < text.length) {
      parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
    }

    return parts;
  };

  return (
    <div className="space-y-3">
      {/* Entity type selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Tag as:</span>
        {entityTypes.map((et) => (
          <button
            key={et.id}
            onClick={() => setActiveType(et)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-all ${
              activeType.id === et.id
                ? "border-foreground bg-foreground/5 font-medium"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: et.color }}
            />
            {et.label}
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

      {/* Instruction */}
      <p className="text-[11px] text-muted-foreground">
        Select text with your cursor to tag it. Click a highlighted span to remove it.
      </p>

      {/* Text content */}
      <div
        id="ner-text-container"
        className="rounded-lg border bg-card p-4 text-[14px] leading-relaxed select-text cursor-text"
        onMouseUp={handleTextSelect}
      >
        {renderAnnotatedText()}
      </div>

      {/* Entity list */}
      {value.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {value.length} entit{value.length === 1 ? "y" : "ies"} tagged
          </span>
          <div className="flex flex-wrap gap-1.5">
            {value.map((span) => {
              const et = entityTypes.find((e) => e.id === span.entityTypeId);
              return (
                <Badge
                  key={span.id}
                  variant="outline"
                  className="text-[11px] gap-1"
                  style={{
                    borderColor: et?.color,
                    color: et?.color,
                  }}
                >
                  <div
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: et?.color }}
                  />
                  <span className="font-normal text-foreground max-w-[120px] truncate">
                    "{span.text}"
                  </span>
                  → {et?.label}
                  <button
                    onClick={() => removeSpan(span.id)}
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
