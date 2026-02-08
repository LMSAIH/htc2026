/**
 * Task Configuration Editor
 *
 * Follows Label Studio / Labelbox / Prodigy patterns:
 * - Per-task schema configuration (labels, classes, entity types, etc.)
 * - Input type definition (what kind of data is expected)
 * - Output schema definition (what annotations should look like)
 * - Custom instructions, required/optional, validation rules
 *
 * Used by reviewers to define exactly what annotators see and produce.
 */

import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Palette,
  X,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Info,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  TaskConfig,
  LabelOption,
  DrawingClass,
  EntityType,
  AnnotationTaskTemplate,
  UIComponentType,
} from "@/lib/annotation-tasks";
import type { MissionTaskConfig } from "@/lib/mock-data";

// ─── Predefined color palette (industry standard annotation colors) ──
const COLOR_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#78716c", "#6b7280", "#475569",
];

// ─── UI Component Human Labels ──────────────────────────────────────
const UI_COMPONENT_LABELS: Record<UIComponentType, string> = {
  radio_group: "Single Choice (Radio)",
  checkbox_group: "Multi Choice (Checkbox)",
  slider: "Numeric Slider",
  text_input: "Short Text Input",
  textarea: "Long Text Area",
  bounding_box_canvas: "Bounding Box Canvas",
  keypoint_canvas: "Keypoint Canvas",
  polygon_canvas: "Polygon Canvas",
  text_highlighter: "Text Span Highlighter",
  audio_player_transcribe: "Audio Transcription Player",
  audio_segment_tagger: "Audio Segment Tagger",
  qa_pair: "Question-Answer Pair",
  table_row_tagger: "Table Row Tagger",
  timeseries_range_selector: "Time Series Range Selector",
  dropdown_select: "Dropdown Select",
  image_captioner: "Image Caption Input",
  vqa_widget: "Visual Q&A Widget",
  modality_matcher: "Modality Matcher",
};

// ─── Output format descriptions by UI component ────────────────────
const OUTPUT_FORMAT_DESCRIPTIONS: Record<UIComponentType, string> = {
  radio_group: "Produces a single selected label ID (string). Annotators pick exactly one option.",
  checkbox_group: "Produces an array of selected label IDs (string[]). Annotators pick one or more options.",
  slider: "Produces a numeric value within the configured range.",
  text_input: "Produces a short text string (single line).",
  textarea: "Produces a multi-line text block (paragraph).",
  bounding_box_canvas: "Produces array of {classId, x, y, width, height} rectangles on the image.",
  keypoint_canvas: "Produces array of {classId, points: [{x, y, label}]} keypoint sets.",
  polygon_canvas: "Produces array of {classId, points: [{x, y}]} polygon outlines.",
  text_highlighter: "Produces array of {entityTypeId, startOffset, endOffset, text} spans.",
  audio_player_transcribe: "Produces a text transcription of the audio content.",
  audio_segment_tagger: "Produces array of {labelId, startTime, endTime} time segments.",
  qa_pair: "Produces {question, answer} text pairs.",
  table_row_tagger: "Produces per-row label assignments.",
  timeseries_range_selector: "Produces array of {labelId, startIndex, endIndex} ranges.",
  dropdown_select: "Produces a single selected label ID (string) from a dropdown.",
  image_captioner: "Produces a text caption describing the image.",
  vqa_widget: "Produces {question, answer} pairs about visual content.",
  modality_matcher: "Produces alignment labels between different data modalities.",
};

// ─── Determine which config sections are relevant ───────────────────
type ConfigSection = "labels" | "classes" | "entityTypes" | "segmentLabels" | "numeric" | "text" | "qa";

function getRelevantSections(uiComponent: UIComponentType): ConfigSection[] {
  switch (uiComponent) {
    case "radio_group":
    case "checkbox_group":
    case "dropdown_select":
    case "modality_matcher":
      return ["labels"];
    case "bounding_box_canvas":
    case "keypoint_canvas":
    case "polygon_canvas":
      return ["classes"];
    case "text_highlighter":
      return ["entityTypes"];
    case "audio_segment_tagger":
    case "timeseries_range_selector":
      return ["segmentLabels"];
    case "slider":
      return ["numeric"];
    case "text_input":
    case "textarea":
    case "image_captioner":
    case "audio_player_transcribe":
      return ["text"];
    case "qa_pair":
    case "vqa_widget":
      return ["qa", "text"];
    case "table_row_tagger":
      return ["labels"];
    default:
      return [];
  }
}

// ─── Label-like item editor (shared for labels, classes, entity types) ─
interface LabelItemEditorProps {
  items: Array<{ id: string; label: string; color?: string; description?: string; hotkey?: string }>;
  onChange: (items: Array<{ id: string; label: string; color?: string; description?: string; hotkey?: string }>) => void;
  noun: string; // "label" | "class" | "entity type" | "segment label"
  showColor?: boolean;
  showDescription?: boolean;
  showHotkey?: boolean;
}

function LabelItemEditor({ items, onChange, noun, showColor = true, showDescription = false, showHotkey = false }: LabelItemEditorProps) {
  const addItem = () => {
    const nextColor = COLOR_PALETTE[items.length % COLOR_PALETTE.length];
    onChange([
      ...items,
      { id: `new_${Date.now()}`, label: `New ${noun}`, color: nextColor, description: "", hotkey: "" },
    ]);
  };

  const removeItem = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(next);
  };

  const updateItem = (idx: number, patch: Partial<typeof items[0]>) => {
    const next = items.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground border border-dashed rounded-lg p-3">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          No {noun}s defined. Add at least one.
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        {items.map((item, idx) => (
          <div key={item.id} className="group flex items-start gap-2 bg-muted/30 rounded-lg p-2.5 border">
            <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-2 shrink-0 cursor-grab" />
            {showColor && (
              <div className="relative shrink-0 mt-1.5">
                <div
                  className="h-5 w-5 rounded-md border cursor-pointer"
                  style={{ backgroundColor: item.color || "#6b7280" }}
                />
                <input
                  type="color"
                  value={item.color || "#6b7280"}
                  onChange={(e) => updateItem(idx, { color: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-5 h-5"
                  title="Pick color"
                />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              <Input
                value={item.label}
                onChange={(e) => updateItem(idx, { label: e.target.value })}
                placeholder={`${noun} name`}
                className="h-8 text-[13px]"
              />
              {showDescription && (
                <Input
                  value={item.description || ""}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                  placeholder="Description (optional)"
                  className="h-7 text-[12px]"
                />
              )}
              {showHotkey && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Hotkey:</span>
                  <Input
                    value={item.hotkey || ""}
                    onChange={(e) => updateItem(idx, { hotkey: e.target.value.slice(0, 1) })}
                    placeholder="—"
                    className="h-7 w-12 text-[12px] text-center"
                    maxLength={1}
                  />
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-red-500 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeItem(idx)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="gap-1.5 text-[12px] h-8 w-full" onClick={addItem}>
        <Plus className="h-3.5 w-3.5" />
        Add {noun}
      </Button>
    </div>
  );
}

// ─── Main exported component ────────────────────────────────────────
export interface TaskConfigEditorProps {
  /** The template being configured */
  template: AnnotationTaskTemplate;
  /** Current task configuration (overrides + meta) */
  taskConfig: MissionTaskConfig;
  /** Called whenever config changes */
  onChange: (updated: MissionTaskConfig) => void;
}

export function TaskConfigEditor({ template, taskConfig, onChange }: TaskConfigEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(["output-schema", "instructions"]),
  );

  const config: TaskConfig = {
    ...template.defaultConfig,
    ...(taskConfig.configOverrides ?? {}),
  };

  const sections = getRelevantSections(template.uiComponent);

  const updateConfig = useCallback(
    (patch: Partial<TaskConfig>) => {
      onChange({
        ...taskConfig,
        configOverrides: { ...(taskConfig.configOverrides ?? {}), ...patch },
      });
    },
    [taskConfig, onChange],
  );

  const updateMeta = useCallback(
    (patch: Partial<MissionTaskConfig>) => {
      onChange({ ...taskConfig, ...patch });
    },
    [taskConfig, onChange],
  );

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Header info */}
      <div className="flex items-start gap-3 pb-2">
        <span className="text-2xl">{template.emoji}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[15px]">{template.label}</h4>
          <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{template.description}</p>
        </div>
        <Badge variant="outline" className="text-[11px] shrink-0 whitespace-nowrap">
          {UI_COMPONENT_LABELS[template.uiComponent]}
        </Badge>
      </div>

      <Separator />

      {/* ═══ Instructions & Meta ═══ */}
      <Collapsible
        open={expandedSections.has("instructions")}
        onOpenChange={() => toggleSection("instructions")}
      >
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1 hover:text-foreground transition-colors">
          {expandedSections.has("instructions") ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-[13px] font-semibold">Task Instructions &amp; Settings</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 sm:pl-6 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium">Custom Title</Label>
            <Input
              value={taskConfig.customTitle ?? ""}
              onChange={(e) =>
                updateMeta({ customTitle: e.target.value || undefined })
              }
              placeholder={template.label}
              className="h-9 text-[13px]"
            />
            <p className="text-[11px] text-muted-foreground">
              Override the default task name shown to annotators.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium">Custom Instructions</Label>
            <Textarea
              value={taskConfig.customInstruction ?? ""}
              onChange={(e) =>
                updateMeta({ customInstruction: e.target.value || undefined })
              }
              placeholder={template.description}
              rows={3}
              className="text-[13px] resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Specific instructions shown to annotators for this task. Clearly describe what you expect.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-[12px] font-medium">Required Task</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Annotators must complete this task before submitting.
              </p>
            </div>
            <Switch
              checked={taskConfig.required ?? false}
              onCheckedChange={(v) => updateMeta({ required: v })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* ═══ Output Schema / Data Definition ═══ */}
      <Collapsible
        open={expandedSections.has("output-schema")}
        onOpenChange={() => toggleSection("output-schema")}
      >
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1 hover:text-foreground transition-colors">
          {expandedSections.has("output-schema") ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-[13px] font-semibold">Output Schema &amp; Options</span>
          <Badge variant="secondary" className="text-[10px] ml-auto">
            {sections.length > 0 ? sections.join(", ") : "fixed format"}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 sm:pl-6 space-y-4">
          {/* Output format info */}
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-medium text-blue-800 dark:text-blue-300">Output Format</p>
              <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                {OUTPUT_FORMAT_DESCRIPTIONS[template.uiComponent]}
              </p>
            </div>
          </div>

          {/* ─── Labels Section ─── */}
          {sections.includes("labels") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[12px] font-medium">
                  Labels / Options
                </Label>
                <span className="text-[11px] text-muted-foreground">{(config.labels ?? []).length} defined</span>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Define the choices annotators can select from. Order determines display order.
              </p>
              <LabelItemEditor
                items={(config.labels ?? []) as Array<{ id: string; label: string; color?: string; description?: string; hotkey?: string }>}
                onChange={(items) => updateConfig({ labels: items as LabelOption[] })}
                noun="label"
                showColor
                showDescription
                showHotkey={template.uiComponent === "radio_group" || template.uiComponent === "checkbox_group"}
              />
            </div>
          )}

          {/* ─── Drawing Classes Section ─── */}
          {sections.includes("classes") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[12px] font-medium">
                  Object Classes
                </Label>
                <span className="text-[11px] text-muted-foreground">{(config.classes ?? []).length} defined</span>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Define object classes that annotators can draw on the canvas. Each class gets a unique color.
              </p>
              <LabelItemEditor
                items={(config.classes ?? []).map((c) => ({ ...c, hotkey: undefined }))}
                onChange={(items) =>
                  updateConfig({
                    classes: items.map((i) => ({
                      id: i.id,
                      label: i.label,
                      color: i.color || "#ef4444",
                      description: i.description,
                    })) as DrawingClass[],
                  })
                }
                noun="class"
                showColor
                showDescription
              />
              {config.minAnnotations !== undefined && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[12px] font-medium">Minimum Annotations Per File</Label>
                    <span className="text-[12px] font-mono tabular-nums">{config.minAnnotations}</span>
                  </div>
                  <Slider
                    value={[config.minAnnotations]}
                    onValueChange={([v]) => updateConfig({ minAnnotations: v })}
                    min={0}
                    max={50}
                    step={1}
                  />
                </div>
              )}
            </div>
          )}

          {/* ─── Entity Types Section ─── */}
          {sections.includes("entityTypes") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[12px] font-medium">
                  Entity Types
                </Label>
                <span className="text-[11px] text-muted-foreground">{(config.entityTypes ?? []).length} defined</span>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Define named entity categories (e.g., Person, Location, Organization) for text span labeling.
              </p>
              <LabelItemEditor
                items={(config.entityTypes ?? []).map((e) => ({ ...e, hotkey: undefined }))}
                onChange={(items) =>
                  updateConfig({
                    entityTypes: items.map((i) => ({
                      id: i.id,
                      label: i.label,
                      color: i.color || "#3b82f6",
                      description: i.description,
                    })) as EntityType[],
                  })
                }
                noun="entity type"
                showColor
                showDescription
              />
            </div>
          )}

          {/* ─── Segment Labels Section ─── */}
          {sections.includes("segmentLabels") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[12px] font-medium">
                  Segment Labels
                </Label>
                <span className="text-[11px] text-muted-foreground">{(config.segmentLabels ?? []).length} defined</span>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Define labels for time/audio segments. Annotators will mark ranges and assign these labels.
              </p>
              <LabelItemEditor
                items={(config.segmentLabels ?? []).map((s) => ({ ...s, hotkey: undefined }))}
                onChange={(items) =>
                  updateConfig({
                    segmentLabels: items.map((i) => ({
                      id: i.id,
                      label: i.label,
                      color: i.color || "#3b82f6",
                      description: i.description,
                    })) as LabelOption[],
                  })
                }
                noun="segment label"
                showColor
                showDescription
              />
            </div>
          )}

          {/* ─── Numeric Config ─── */}
          {sections.includes("numeric") && (
            <div className="space-y-3">
              <Label className="text-[12px] font-medium">Numeric Range</Label>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Configure the rating scale range and step size.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Min</Label>
                  <Input
                    type="number"
                    value={config.min ?? 1}
                    onChange={(e) => updateConfig({ min: Number(e.target.value) })}
                    className="h-8 text-[13px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Max</Label>
                  <Input
                    type="number"
                    value={config.max ?? 5}
                    onChange={(e) => updateConfig({ max: Number(e.target.value) })}
                    className="h-8 text-[13px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Step</Label>
                  <Input
                    type="number"
                    value={config.step ?? 1}
                    onChange={(e) => updateConfig({ step: Number(e.target.value) })}
                    className="h-8 text-[13px]"
                    min={0.1}
                    step={0.1}
                  />
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Preview</p>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] tabular-nums">{config.min ?? 1}</span>
                  <Slider
                    value={[Math.round(((config.min ?? 1) + (config.max ?? 5)) / 2)]}
                    min={config.min ?? 1}
                    max={config.max ?? 5}
                    step={config.step ?? 1}
                    disabled
                    className="flex-1"
                  />
                  <span className="text-[12px] tabular-nums">{config.max ?? 5}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── Text Config ─── */}
          {sections.includes("text") && (
            <div className="space-y-3">
              <Label className="text-[12px] font-medium">Text Input Settings</Label>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Configure the placeholder and length constraints for text responses.
              </p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Placeholder Text</Label>
                  <Input
                    value={config.placeholder ?? ""}
                    onChange={(e) => updateConfig({ placeholder: e.target.value })}
                    placeholder="e.g., Describe what you see…"
                    className="h-8 text-[13px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Max Character Length</Label>
                  <Input
                    type="number"
                    value={config.maxLength ?? ""}
                    onChange={(e) =>
                      updateConfig({
                        maxLength: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="No limit"
                    className="h-8 text-[13px]"
                    min={1}
                  />
                  <p className="text-[11px] text-muted-foreground">Leave empty for unlimited.</p>
                </div>
              </div>
            </div>
          )}

          {/* ─── QA Config ─── */}
          {sections.includes("qa") && (
            <div className="space-y-3">
              <Label className="text-[12px] font-medium">Question Template</Label>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Define the base question or prompt shown to annotators when answering.
              </p>
              <Textarea
                value={config.questionTemplate ?? ""}
                onChange={(e) => updateConfig({ questionTemplate: e.target.value })}
                placeholder="e.g., Answer the following question about the image as accurately as possible."
                rows={2}
                className="text-[13px] resize-none"
              />
            </div>
          )}

          {/* Empty state for fixed-format tasks */}
          {sections.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-[13px] font-medium">Fixed output format</p>
              <p className="text-[12px] mt-0.5">
                This task type produces a standardized output. No additional schema configuration needed.
              </p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
