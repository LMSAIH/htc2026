/**
 * Task Renderer
 *
 * Master component that routes annotation tasks to the correct
 * UI component based on the task template's uiComponent type.
 * This is the single entry point for rendering any annotation task.
 */

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { CheckCircle2 } from "lucide-react";
import type {
  AnnotationTaskTemplate,
  LabelOption,
} from "@/lib/annotation-tasks";
import { BoundingBoxCanvas, type BBox } from "./bounding-box-canvas";
import { TextHighlighter, type TextSpan } from "./text-highlighter";
import { AudioTranscriber } from "./audio-transcriber";
import { VQAWidget, type VQAPair } from "./vqa-widget";
import { TimeseriesRangeSelector, type TSRange } from "./timeseries-range-selector";

// ─── Value union ────────────────────────────────────────────────────
export type AnnotationValue =
  | string
  | string[]
  | number
  | BBox[]
  | TextSpan[]
  | VQAPair[]
  | TSRange[]
  | null;

interface TaskRendererProps {
  template: AnnotationTaskTemplate;
  filename: string;
  /** Sample text content (for text tasks) */
  textContent?: string;
  value: AnnotationValue;
  onChange: (value: AnnotationValue) => void;
}

export function TaskRenderer({
  template,
  filename,
  textContent,
  value,
  onChange,
}: TaskRendererProps) {
  const config = template.defaultConfig;

  switch (template.uiComponent) {
    // ═══════════════════════════════════
    //  RADIO GROUP (single select)
    // ═══════════════════════════════════
    case "radio_group":
      return (
        <RadioGroup
          labels={config.labels ?? []}
          value={value as string | null}
          onChange={(v) => onChange(v)}
        />
      );

    // ═══════════════════════════════════
    //  CHECKBOX GROUP (multi select)
    // ═══════════════════════════════════
    case "checkbox_group":
      return (
        <CheckboxGroup
          labels={config.labels ?? []}
          value={(value as string[]) ?? []}
          onChange={(v) => onChange(v)}
        />
      );

    // ═══════════════════════════════════
    //  SLIDER (numeric)
    // ═══════════════════════════════════
    case "slider":
      return (
        <NumericSlider
          min={config.min ?? 1}
          max={config.max ?? 5}
          step={config.step ?? 1}
          value={value as number | null}
          onChange={(v) => onChange(v)}
        />
      );

    // ═══════════════════════════════════
    //  TEXT INPUT
    // ═══════════════════════════════════
    case "text_input":
      return (
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.placeholder ?? "Type here…"}
          maxLength={config.maxLength}
          className="text-[13px]"
        />
      );

    // ═══════════════════════════════════
    //  TEXTAREA
    // ═══════════════════════════════════
    case "textarea":
    case "image_captioner":
      return (
        <div className="space-y-2">
          <Textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={config.placeholder ?? "Type here…"}
            maxLength={config.maxLength}
            rows={4}
            className="text-[13px] leading-relaxed"
          />
          {config.maxLength && (
            <p className="text-[11px] text-muted-foreground text-right">
              {((value as string) ?? "").length} / {config.maxLength}
            </p>
          )}
        </div>
      );

    // ═══════════════════════════════════
    //  DROPDOWN SELECT
    // ═══════════════════════════════════
    case "dropdown_select":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-[13px] bg-background"
        >
          <option value="">Select…</option>
          {(config.labels ?? []).map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    // ═══════════════════════════════════
    //  BOUNDING BOX CANVAS
    // ═══════════════════════════════════
    case "bounding_box_canvas":
      return (
        <BoundingBoxCanvas
          filename={filename}
          classes={config.classes ?? []}
          value={(value as BBox[]) ?? []}
          onChange={(boxes) => onChange(boxes)}
        />
      );

    // ═══════════════════════════════════
    //  TEXT HIGHLIGHTER (NER)
    // ═══════════════════════════════════
    case "text_highlighter":
      return (
        <TextHighlighter
          text={
            textContent ??
            "Sample text content for annotation. Select text spans and tag them with entity types."
          }
          entityTypes={config.entityTypes ?? []}
          value={(value as TextSpan[]) ?? []}
          onChange={(spans) => onChange(spans)}
        />
      );

    // ═══════════════════════════════════
    //  AUDIO PLAYER + TRANSCRIPTION
    // ═══════════════════════════════════
    case "audio_player_transcribe":
      return (
        <AudioTranscriber
          filename={filename}
          placeholder={config.placeholder}
          value={(value as string) ?? ""}
          onChange={(text) => onChange(text)}
        />
      );

    // ═══════════════════════════════════
    //  AUDIO SEGMENT TAGGER
    // ═══════════════════════════════════
    case "audio_segment_tagger":
      return (
        <TimeseriesRangeSelector
          filename={filename}
          labels={config.segmentLabels ?? config.labels ?? []}
          value={(value as TSRange[]) ?? []}
          onChange={(ranges) => onChange(ranges)}
        />
      );

    // ═══════════════════════════════════
    //  VQA WIDGET
    // ═══════════════════════════════════
    case "vqa_widget":
      return (
        <VQAWidget
          filename={filename}
          presetQuestions={[
            "What objects can you identify in this image?",
            "Describe the condition of the main subject.",
            "What is the approximate setting/environment?",
          ]}
          value={(value as VQAPair[]) ?? []}
          onChange={(pairs) => onChange(pairs)}
        />
      );

    // ═══════════════════════════════════
    //  QA PAIR
    // ═══════════════════════════════════
    case "qa_pair":
      return (
        <div className="space-y-3">
          {textContent && (
            <div className="rounded-lg border bg-muted/20 p-4 text-[13px] leading-relaxed max-h-40 overflow-y-auto">
              {textContent}
            </div>
          )}
          <Textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={config.placeholder ?? "Type your answer…"}
            rows={3}
            className="text-[13px]"
          />
        </div>
      );

    // ═══════════════════════════════════
    //  TIMESERIES RANGE SELECTOR
    // ═══════════════════════════════════
    case "timeseries_range_selector":
      return (
        <TimeseriesRangeSelector
          filename={filename}
          labels={config.segmentLabels ?? config.labels ?? []}
          value={(value as TSRange[]) ?? []}
          onChange={(ranges) => onChange(ranges)}
        />
      );

    // ═══════════════════════════════════
    //  TABLE ROW TAGGER
    // ═══════════════════════════════════
    case "table_row_tagger":
      return (
        <RadioGroup
          labels={config.labels ?? []}
          value={value as string | null}
          onChange={(v) => onChange(v)}
        />
      );

    // ═══════════════════════════════════
    //  MODALITY MATCHER
    // ═══════════════════════════════════
    case "modality_matcher":
      return (
        <RadioGroup
          labels={config.labels ?? []}
          value={value as string | null}
          onChange={(v) => onChange(v)}
        />
      );

    // ═══════════════════════════════════
    //  KEYPOINT / POLYGON (simplified)
    // ═══════════════════════════════════
    case "keypoint_canvas":
    case "polygon_canvas":
      return (
        <div className="rounded-lg border bg-muted/20 p-6 text-center text-muted-foreground">
          <p className="text-sm font-medium mb-1">
            {template.uiComponent === "keypoint_canvas"
              ? "Keypoint Detection"
              : "Polygon Segmentation"}
          </p>
          <p className="text-xs">
            Advanced spatial annotation tool — available in the annotation workspace.
            Click points on the image to place markers.
          </p>
          {/* Simplified fallback: Use bounding box canvas */}
          <div className="mt-3">
            <BoundingBoxCanvas
              filename={filename}
              classes={config.classes ?? []}
              value={(value as BBox[]) ?? []}
              onChange={(boxes) => onChange(boxes)}
            />
          </div>
        </div>
      );

    default:
      return (
        <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
          Unsupported task component: {template.uiComponent}
        </div>
      );
  }
}

// ─── Reusable sub-components ────────────────────────────────────────

function RadioGroup({
  labels,
  value,
  onChange,
}: {
  labels: LabelOption[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {labels.map((opt, idx) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id ?? `radio-${idx}`}
            onClick={() => onChange(opt.id)}
            className={`w-full text-left rounded-lg border p-3 transition-all ${
              selected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-primary/30 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30"
                }`}
              >
                {selected && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-medium flex items-center gap-2">
                  {opt.hotkey && (
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">
                      {opt.hotkey}
                    </kbd>
                  )}
                  {opt.color && (
                    <div
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  {opt.label}
                </span>
                {opt.description && (
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {opt.description}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CheckboxGroup({
  labels,
  value,
  onChange,
}: {
  labels: LabelOption[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {labels.map((opt, idx) => {
        const checked = value.includes(opt.id);
        return (
          <button
            key={opt.id ?? `cb-${idx}`}
            onClick={() => {
              const newVal = checked
                ? value.filter((v) => v !== opt.id)
                : [...value, opt.id];
              onChange(newVal);
            }}
            className={`w-full text-left rounded-lg border p-3 transition-all ${
              checked
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-primary/30 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                  checked
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30"
                }`}
              >
                {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
              </div>
              <div>
                <span className="text-[13px] font-medium flex items-center gap-2">
                  {opt.color && (
                    <div
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  {opt.label}
                </span>
                {opt.description && (
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {opt.description}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function NumericSlider({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number | null;
  onChange: (value: number) => void;
}) {
  const current = value ?? min;
  return (
    <div className="space-y-4">
      <div className="text-center">
        <span className="text-3xl font-bold tabular-nums">{current}</span>
        <span className="text-sm text-muted-foreground ml-1">
          / {max}
        </span>
      </div>
      <Slider
        value={[current]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]: number[]) => onChange(v)}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
