/**
 * Annotation Task Template System
 *
 * Based on Label Studio, Labelbox, Scale AI, and CVAT annotation workflows.
 * Each model type has a curated set of task templates that can be selected
 * when creating a mission. The annotation workspace renders the right UI
 * component per task type.
 */

import type { ModelType } from "./mock-data";

// ─── Extended task types (beyond the generic ones) ──────────────────
export type AnnotationTaskType =
  // ── Classification (universal) ──
  | "single_classification"
  | "multi_classification"
  // ── Numeric / text (universal) ──
  | "numeric_rating"
  | "free_text"
  // ── Vision-specific ──
  | "bounding_box"
  | "image_classification"
  | "image_captioning"
  | "visual_qa"
  | "keypoint_detection"
  | "polygon_segmentation"
  // ── Text / NLP-specific ──
  | "named_entity_recognition"
  | "text_classification"
  | "text_span_labeling"
  | "question_answering"
  | "text_summarization"
  | "sentiment_analysis"
  // ── Audio-specific ──
  | "audio_transcription"
  | "audio_classification"
  | "speaker_diarization"
  | "language_identification"
  | "audio_event_detection"
  // ── Multimodal-specific ──
  | "cross_modal_qa"
  | "modality_alignment"
  | "multimodal_captioning"
  // ── Tabular-specific ──
  | "row_classification"
  | "data_validation"
  | "anomaly_flagging"
  | "feature_labeling"
  // ── Time-series-specific ──
  | "event_annotation"
  | "ts_anomaly_detection"
  | "pattern_classification"
  | "trend_labeling";

// ─── Task category (for grouping in UI) ──────────────────────────────
export type TaskCategory =
  | "classification"
  | "spatial"
  | "text_annotation"
  | "audio_annotation"
  | "data_quality"
  | "description"
  | "multimodal";

// ─── Task Template ──────────────────────────────────────────────────
export interface AnnotationTaskTemplate {
  type: AnnotationTaskType;
  category: TaskCategory;
  label: string;
  description: string;
  emoji: string;
  /** Model types this template is available for */
  availableFor: ModelType[];
  /** Whether this is a recommended/default task for its model types */
  recommended: boolean;
  /** Default configuration for this task type */
  defaultConfig: TaskConfig;
  /** The UI component type to render */
  uiComponent: UIComponentType;
}

export type UIComponentType =
  | "radio_group"
  | "checkbox_group"
  | "slider"
  | "text_input"
  | "textarea"
  | "bounding_box_canvas"
  | "keypoint_canvas"
  | "polygon_canvas"
  | "text_highlighter"
  | "audio_player_transcribe"
  | "audio_segment_tagger"
  | "qa_pair"
  | "table_row_tagger"
  | "timeseries_range_selector"
  | "dropdown_select"
  | "image_captioner"
  | "vqa_widget"
  | "modality_matcher";

// ─── Task Config — varies by type ──────────────────────────────────
export interface TaskConfig {
  /** For classification tasks */
  labels?: LabelOption[];
  /** For numeric tasks */
  min?: number;
  max?: number;
  step?: number;
  /** For text tasks */
  placeholder?: string;
  maxLength?: number;
  /** For bounding box / keypoint tasks */
  classes?: DrawingClass[];
  /** Minimum annotations required */
  minAnnotations?: number;
  /** For QA tasks */
  questionTemplate?: string;
  /** For NER */
  entityTypes?: EntityType[];
  /** For audio segmentation */
  segmentLabels?: LabelOption[];
}

export interface LabelOption {
  id: string;
  label: string;
  color?: string;
  description?: string;
  hotkey?: string;
}

export interface DrawingClass {
  id: string;
  label: string;
  color: string;
  description?: string;
}

export interface EntityType {
  id: string;
  label: string;
  color: string;
  description?: string;
}

// ─── Annotation result shapes ───────────────────────────────────────
export interface BoundingBoxAnnotation {
  id: string;
  classId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
}

export interface KeypointAnnotation {
  id: string;
  classId: string;
  points: Array<{ x: number; y: number; label: string }>;
}

export interface TextSpanAnnotation {
  id: string;
  entityTypeId: string;
  startOffset: number;
  endOffset: number;
  text: string;
}

export interface AudioSegment {
  id: string;
  labelId: string;
  startTime: number;
  endTime: number;
  transcription?: string;
}

export interface TimeseriesRange {
  id: string;
  labelId: string;
  startIndex: number;
  endIndex: number;
  notes?: string;
}

// ─── All task templates ─────────────────────────────────────────────
export const TASK_TEMPLATES: AnnotationTaskTemplate[] = [
  // ════════════════════════════════════
  //  VISION
  // ════════════════════════════════════
  {
    type: "image_classification",
    category: "classification",
    label: "Image Classification",
    description:
      "Classify the entire image into one or more categories. Essential for building image classifiers.",
    emoji: "🏷️",
    availableFor: ["vision", "multimodal"],
    recommended: true,
    defaultConfig: {
      labels: [
        { id: "l1", label: "Class A", color: "#3b82f6" },
        { id: "l2", label: "Class B", color: "#10b981" },
        { id: "l3", label: "Class C", color: "#f59e0b" },
      ],
    },
    uiComponent: "radio_group",
  },
  {
    type: "bounding_box",
    category: "spatial",
    label: "Bounding Box Detection",
    description:
      "Draw rectangles around objects of interest. Standard for object detection models (YOLO, Faster R-CNN).",
    emoji: "⬜",
    availableFor: ["vision", "multimodal"],
    recommended: true,
    defaultConfig: {
      classes: [
        { id: "c1", label: "Object A", color: "#ef4444" },
        { id: "c2", label: "Object B", color: "#3b82f6" },
      ],
      minAnnotations: 1,
    },
    uiComponent: "bounding_box_canvas",
  },
  {
    type: "keypoint_detection",
    category: "spatial",
    label: "Keypoint Detection",
    description:
      "Mark specific points on objects (e.g., body joints, facial landmarks). Used for pose estimation.",
    emoji: "📍",
    availableFor: ["vision"],
    recommended: false,
    defaultConfig: {
      classes: [
        { id: "kp1", label: "Point A", color: "#8b5cf6" },
        { id: "kp2", label: "Point B", color: "#ec4899" },
      ],
    },
    uiComponent: "keypoint_canvas",
  },
  {
    type: "polygon_segmentation",
    category: "spatial",
    label: "Polygon Segmentation",
    description:
      "Draw polygon outlines around object boundaries. For instance segmentation and semantic segmentation training.",
    emoji: "🔷",
    availableFor: ["vision"],
    recommended: false,
    defaultConfig: {
      classes: [
        { id: "seg1", label: "Region A", color: "#06b6d4" },
        { id: "seg2", label: "Region B", color: "#84cc16" },
      ],
    },
    uiComponent: "polygon_canvas",
  },
  {
    type: "image_captioning",
    category: "description",
    label: "Image Captioning",
    description:
      "Write a natural language description of the image. For image captioning and vision-language models.",
    emoji: "💬",
    availableFor: ["vision", "multimodal"],
    recommended: true,
    defaultConfig: {
      placeholder: "Describe what you see in this image…",
      maxLength: 500,
    },
    uiComponent: "image_captioner",
  },
  {
    type: "visual_qa",
    category: "description",
    label: "Visual Q&A",
    description:
      "Answer questions about the image content. Trains VQA models to reason about visual inputs.",
    emoji: "❓",
    availableFor: ["vision", "multimodal"],
    recommended: true,
    defaultConfig: {
      questionTemplate:
        "Answer the following question about the image as accurately as possible.",
    },
    uiComponent: "vqa_widget",
  },

  // ════════════════════════════════════
  //  TEXT / NLP
  // ════════════════════════════════════
  {
    type: "text_classification",
    category: "classification",
    label: "Text Classification",
    description:
      "Categorize text documents by topic, intent, or type. Foundation for text classifiers.",
    emoji: "📋",
    availableFor: ["text"],
    recommended: true,
    defaultConfig: {
      labels: [
        { id: "tc1", label: "Category A", color: "#3b82f6" },
        { id: "tc2", label: "Category B", color: "#10b981" },
      ],
    },
    uiComponent: "radio_group",
  },
  {
    type: "sentiment_analysis",
    category: "classification",
    label: "Sentiment Analysis",
    description:
      "Label text as positive, negative, or neutral. Standard for training sentiment classifiers.",
    emoji: "😊",
    availableFor: ["text"],
    recommended: true,
    defaultConfig: {
      labels: [
        { id: "pos", label: "Positive", color: "#10b981", hotkey: "1" },
        { id: "neu", label: "Neutral", color: "#6b7280", hotkey: "2" },
        { id: "neg", label: "Negative", color: "#ef4444", hotkey: "3" },
      ],
    },
    uiComponent: "radio_group",
  },
  {
    type: "named_entity_recognition",
    category: "text_annotation",
    label: "Named Entity Recognition (NER)",
    description:
      "Highlight and label text spans as entities (person, location, org, etc.). Core NLP annotation task.",
    emoji: "🔤",
    availableFor: ["text"],
    recommended: true,
    defaultConfig: {
      entityTypes: [
        { id: "per", label: "Person", color: "#3b82f6" },
        { id: "loc", label: "Location", color: "#10b981" },
        { id: "org", label: "Organization", color: "#f59e0b" },
        { id: "date", label: "Date", color: "#8b5cf6" },
        { id: "misc", label: "Miscellaneous", color: "#ec4899" },
      ],
    },
    uiComponent: "text_highlighter",
  },
  {
    type: "question_answering",
    category: "description",
    label: "Question Answering",
    description:
      "Given a passage, answer questions about it. For training extractive and generative QA models.",
    emoji: "❔",
    availableFor: ["text"],
    recommended: false,
    defaultConfig: {
      questionTemplate: "Read the passage and answer the question below.",
      placeholder: "Type your answer…",
    },
    uiComponent: "qa_pair",
  },
  {
    type: "text_summarization",
    category: "description",
    label: "Text Summarization",
    description:
      "Write a concise summary of the given text. For training abstractive/extractive summarization models.",
    emoji: "📝",
    availableFor: ["text"],
    recommended: false,
    defaultConfig: {
      placeholder: "Write a concise summary of the text above…",
      maxLength: 300,
    },
    uiComponent: "textarea",
  },

  // ════════════════════════════════════
  //  AUDIO
  // ════════════════════════════════════
  {
    type: "audio_transcription",
    category: "audio_annotation",
    label: "Audio Transcription",
    description:
      "Transcribe spoken audio into text. Essential for ASR (automatic speech recognition) training.",
    emoji: "✍️",
    availableFor: ["audio"],
    recommended: true,
    defaultConfig: {
      placeholder: "Type what you hear…",
    },
    uiComponent: "audio_player_transcribe",
  },
  {
    type: "audio_classification",
    category: "classification",
    label: "Audio Classification",
    description:
      "Classify the audio clip by type (e.g., speech, music, noise, environment sounds).",
    emoji: "🎵",
    availableFor: ["audio"],
    recommended: true,
    defaultConfig: {
      labels: [
        { id: "speech", label: "Speech", color: "#3b82f6" },
        { id: "music", label: "Music", color: "#8b5cf6" },
        { id: "noise", label: "Environmental Noise", color: "#f59e0b" },
        { id: "silence", label: "Silence", color: "#6b7280" },
      ],
    },
    uiComponent: "radio_group",
  },
  {
    type: "speaker_diarization",
    category: "audio_annotation",
    label: "Speaker Diarization",
    description:
      "Identify and tag different speakers in the audio. For multi-speaker models and meeting transcription.",
    emoji: "👥",
    availableFor: ["audio"],
    recommended: false,
    defaultConfig: {
      segmentLabels: [
        { id: "spk1", label: "Speaker 1", color: "#3b82f6" },
        { id: "spk2", label: "Speaker 2", color: "#10b981" },
        { id: "spk3", label: "Speaker 3", color: "#f59e0b" },
        { id: "overlap", label: "Overlap", color: "#ef4444" },
      ],
    },
    uiComponent: "audio_segment_tagger",
  },
  {
    type: "language_identification",
    category: "classification",
    label: "Language Identification",
    description:
      "Identify the language being spoken. Critical for multilingual and code-switching models.",
    emoji: "🌍",
    availableFor: ["audio"],
    recommended: true,
    defaultConfig: {
      labels: [
        { id: "en", label: "English", color: "#3b82f6" },
        { id: "es", label: "Spanish", color: "#ef4444" },
        { id: "fr", label: "French", color: "#8b5cf6" },
        { id: "other", label: "Other", color: "#6b7280" },
      ],
    },
    uiComponent: "dropdown_select",
  },
  {
    type: "audio_event_detection",
    category: "audio_annotation",
    label: "Sound Event Detection",
    description:
      "Mark timestamps where specific sounds occur. For sound event detection and audio tagging.",
    emoji: "🔊",
    availableFor: ["audio"],
    recommended: false,
    defaultConfig: {
      segmentLabels: [
        { id: "evt1", label: "Event A", color: "#3b82f6" },
        { id: "evt2", label: "Event B", color: "#10b981" },
      ],
    },
    uiComponent: "audio_segment_tagger",
  },

  // ════════════════════════════════════
  //  MULTIMODAL
  // ════════════════════════════════════
  {
    type: "cross_modal_qa",
    category: "multimodal",
    label: "Cross-Modal Q&A",
    description:
      "Answer questions that require interpreting multiple data types (image + text, audio + text, etc.).",
    emoji: "🔀",
    availableFor: ["multimodal"],
    recommended: true,
    defaultConfig: {
      questionTemplate:
        "Using both the image and the text provided, answer the following question.",
      placeholder: "Type your answer…",
    },
    uiComponent: "qa_pair",
  },
  {
    type: "modality_alignment",
    category: "multimodal",
    label: "Modality Alignment",
    description:
      "Verify that different data modalities (image, text, coordinates) are correctly paired and consistent.",
    emoji: "🔗",
    availableFor: ["multimodal"],
    recommended: true,
    defaultConfig: {
      labels: [
        { id: "aligned", label: "Correctly Aligned", color: "#10b981" },
        { id: "mismatch", label: "Mismatched", color: "#ef4444" },
        { id: "partial", label: "Partially Aligned", color: "#f59e0b" },
      ],
    },
    uiComponent: "radio_group",
  },
  {
    type: "multimodal_captioning",
    category: "description",
    label: "Multimodal Captioning",
    description:
      "Write a description that integrates information from all provided modalities.",
    emoji: "📖",
    availableFor: ["multimodal"],
    recommended: false,
    defaultConfig: {
      placeholder:
        "Describe the combined data, referencing both visual and textual elements…",
      maxLength: 600,
    },
    uiComponent: "textarea",
  },

  // ════════════════════════════════════
  //  TABULAR
  // ════════════════════════════════════
  {
    type: "data_validation",
    category: "data_quality",
    label: "Data Validation",
    description:
      "Check if tabular data entries are valid, complete, and correctly formatted.",
    emoji: "✅",
    availableFor: ["tabular", "time-series"],
    recommended: true,
    defaultConfig: {
      labels: [
        { id: "valid", label: "Valid", color: "#10b981", description: "Data is correct and complete" },
        { id: "suspect", label: "Suspect", color: "#f59e0b", description: "Some values seem off" },
        { id: "invalid", label: "Invalid", color: "#ef4444", description: "Corrupted or incorrect data" },
      ],
    },
    uiComponent: "radio_group",
  },
  {
    type: "row_classification",
    category: "classification",
    label: "Row Classification",
    description:
      "Classify each row/record in a dataset. For building tabular classifiers and data enrichment.",
    emoji: "📊",
    availableFor: ["tabular"],
    recommended: true,
    defaultConfig: {
      labels: [
        { id: "rc1", label: "Class A", color: "#3b82f6" },
        { id: "rc2", label: "Class B", color: "#10b981" },
      ],
    },
    uiComponent: "radio_group",
  },
  {
    type: "anomaly_flagging",
    category: "data_quality",
    label: "Anomaly Flagging",
    description:
      "Flag rows or data points that look anomalous or are outliers. Trains anomaly detection models.",
    emoji: "🚩",
    availableFor: ["tabular", "time-series"],
    recommended: true,
    defaultConfig: {
      labels: [
        { id: "normal", label: "Normal", color: "#10b981" },
        { id: "anomaly", label: "Anomaly", color: "#ef4444" },
        { id: "borderline", label: "Borderline", color: "#f59e0b" },
      ],
    },
    uiComponent: "radio_group",
  },
  {
    type: "feature_labeling",
    category: "data_quality",
    label: "Feature Labeling",
    description:
      "Label or annotate specific features (columns) of a tabular record with semantic meaning.",
    emoji: "🔖",
    availableFor: ["tabular"],
    recommended: false,
    defaultConfig: {
      placeholder: "Describe the key features of this data record…",
    },
    uiComponent: "textarea",
  },

  // ════════════════════════════════════
  //  TIME SERIES
  // ════════════════════════════════════
  {
    type: "event_annotation",
    category: "data_quality",
    label: "Event Annotation",
    description:
      "Mark time ranges where specific events occur. For event detection and temporal classification.",
    emoji: "📌",
    availableFor: ["time-series"],
    recommended: true,
    defaultConfig: {
      segmentLabels: [
        { id: "evt_a", label: "Event A", color: "#3b82f6" },
        { id: "evt_b", label: "Event B", color: "#10b981" },
        { id: "evt_c", label: "Event C", color: "#f59e0b" },
      ],
    },
    uiComponent: "timeseries_range_selector",
  },
  {
    type: "ts_anomaly_detection",
    category: "data_quality",
    label: "Anomaly Detection",
    description:
      "Identify anomalous time periods in sensor/measurement data. Trains anomaly detection algorithms.",
    emoji: "📉",
    availableFor: ["time-series"],
    recommended: true,
    defaultConfig: {
      labels: [
        { id: "ts_normal", label: "Normal", color: "#10b981" },
        { id: "ts_anomaly", label: "Anomalous", color: "#ef4444" },
        { id: "ts_transition", label: "Transition", color: "#f59e0b" },
      ],
    },
    uiComponent: "radio_group",
  },
  {
    type: "pattern_classification",
    category: "classification",
    label: "Pattern Classification",
    description:
      "Classify temporal patterns (trend, seasonal, cyclic, irregular). Helps train time-series models.",
    emoji: "📈",
    availableFor: ["time-series"],
    recommended: false,
    defaultConfig: {
      labels: [
        { id: "trend_up", label: "Upward Trend", color: "#10b981" },
        { id: "trend_down", label: "Downward Trend", color: "#ef4444" },
        { id: "stable", label: "Stable", color: "#6b7280" },
        { id: "cyclic", label: "Cyclic", color: "#8b5cf6" },
        { id: "irregular", label: "Irregular", color: "#f59e0b" },
      ],
    },
    uiComponent: "radio_group",
  },
  {
    type: "trend_labeling",
    category: "description",
    label: "Trend Description",
    description:
      "Write a natural language description of the trend/pattern observed in the time window.",
    emoji: "📝",
    availableFor: ["time-series"],
    recommended: false,
    defaultConfig: {
      placeholder: "Describe the trend or pattern you observe in this time window…",
      maxLength: 300,
    },
    uiComponent: "textarea",
  },

  // ════════════════════════════════════
  //  UNIVERSAL (available for all types)
  // ════════════════════════════════════
  {
    type: "single_classification",
    category: "classification",
    label: "Custom Single-Choice",
    description: "A generic single-choice question with custom options.",
    emoji: "🔘",
    availableFor: ["vision", "text", "audio", "multimodal", "tabular", "time-series"],
    recommended: false,
    defaultConfig: {
      labels: [
        { id: "opt1", label: "Option A" },
        { id: "opt2", label: "Option B" },
      ],
    },
    uiComponent: "radio_group",
  },
  {
    type: "multi_classification",
    category: "classification",
    label: "Custom Multi-Choice",
    description: "A generic multi-choice question where multiple options can be selected.",
    emoji: "☑️",
    availableFor: ["vision", "text", "audio", "multimodal", "tabular", "time-series"],
    recommended: false,
    defaultConfig: {
      labels: [
        { id: "mopt1", label: "Option A" },
        { id: "mopt2", label: "Option B" },
      ],
    },
    uiComponent: "checkbox_group",
  },
  {
    type: "numeric_rating",
    category: "data_quality",
    label: "Numeric Rating",
    description: "Rate on a numeric scale (e.g., quality 1-5, confidence 0-100).",
    emoji: "🔢",
    availableFor: ["vision", "text", "audio", "multimodal", "tabular", "time-series"],
    recommended: false,
    defaultConfig: { min: 1, max: 5, step: 1 },
    uiComponent: "slider",
  },
  {
    type: "free_text",
    category: "description",
    label: "Free Text Notes",
    description: "Add freeform notes or observations.",
    emoji: "📝",
    availableFor: ["vision", "text", "audio", "multimodal", "tabular", "time-series"],
    recommended: false,
    defaultConfig: { placeholder: "Add your notes here…" },
    uiComponent: "textarea",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────

/** Get all task templates available for a given model type */
export function getTemplatesForModelType(
  modelType: ModelType,
): AnnotationTaskTemplate[] {
  return TASK_TEMPLATES.filter((t) => t.availableFor.includes(modelType));
}

/** Get recommended (default) templates for a model type */
export function getRecommendedTemplates(
  modelType: ModelType,
): AnnotationTaskTemplate[] {
  return TASK_TEMPLATES.filter(
    (t) => t.availableFor.includes(modelType) && t.recommended,
  );
}

/** Group templates by category */
export function groupTemplatesByCategory(
  templates: AnnotationTaskTemplate[],
): Record<TaskCategory, AnnotationTaskTemplate[]> {
  const groups: Record<string, AnnotationTaskTemplate[]> = {};
  for (const t of templates) {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  }
  return groups as Record<TaskCategory, AnnotationTaskTemplate[]>;
}

/** Human-readable category names */
export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  classification: "Classification",
  spatial: "Spatial Annotation",
  text_annotation: "Text Annotation",
  audio_annotation: "Audio Annotation",
  data_quality: "Data Quality",
  description: "Description & QA",
  multimodal: "Multimodal",
};

/** Get a template by type */
export function getTemplate(
  type: AnnotationTaskType,
): AnnotationTaskTemplate | undefined {
  return TASK_TEMPLATES.find((t) => t.type === type);
}
