import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  SkipForward,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  Image as ImageIcon,
  Music,
  FileSpreadsheet,
  Keyboard,
  Maximize2,
  HelpCircle,
  Layers,
  AlertCircle,
  Shield,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  resolveAnnotationTemplates,
  MODEL_TYPES,
  type DataFile,
} from "@/lib/mock-data";
import {
  TaskRenderer,
  type AnnotationValue,
} from "@/components/annotation/task-renderer";
import { useStore } from "@/lib/store";
import { getFilePreviewUrl } from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────
function fileIcon(ext: string) {
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp"].includes(ext)) return ImageIcon;
  if ([".mp3", ".wav", ".ogg", ".flac", ".m4a"].includes(ext)) return Music;
  if ([".mp4", ".webm", ".mov", ".avi"].includes(ext)) return Video;
  if ([".csv", ".json", ".xlsx", ".tsv", ".xml"].includes(ext)) return FileSpreadsheet;
  return FileText;
}

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".flac", ".m4a"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".avi"]);
const TEXT_EXTS  = new Set([".csv", ".json", ".txt", ".tsv", ".xml", ".md", ".log", ".yaml", ".yml"]);

function MediaPreview({ file, zoom }: { file: DataFile; zoom: number }) {
  const ext = file.type.toLowerCase();
  const url = getFilePreviewUrl(file.id);
  const [loadError, setLoadError] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);

  // Reset state when file changes
  useEffect(() => {
    setLoadError(false);
    setTextContent(null);
  }, [file.id]);

  // Load text content for data files
  useEffect(() => {
    if (!TEXT_EXTS.has(ext)) return;
    setTextLoading(true);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.text();
      })
      .then((t) => { setTextContent(t); setTextLoading(false); })
      .catch(() => { setLoadError(true); setTextLoading(false); });
  }, [file.id, ext, url]);

  const isImage = IMAGE_EXTS.has(ext);
  const isAudio = AUDIO_EXTS.has(ext);
  const isVideo = VIDEO_EXTS.has(ext);
  const isText  = TEXT_EXTS.has(ext);

  // ── Real image preview ──
  if (isImage && !loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center overflow-auto bg-muted/10"
           style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
        <img
          src={url}
          alt={file.filename}
          className="max-w-full max-h-full object-contain"
          onError={() => setLoadError(true)}
        />
      </div>
    );
  }

  // ── Real audio preview ──
  if (isAudio && !loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
        <Music className="h-16 w-16 text-purple-400 opacity-60" />
        <span className="font-mono text-sm text-purple-700 dark:text-purple-300">{file.filename}</span>
        <audio controls src={url} className="w-80" onError={() => setLoadError(true)}>
          Your browser does not support the audio element.
        </audio>
        <span className="text-xs text-muted-foreground">{(file.size_kb / 1024).toFixed(1)} MB</span>
      </div>
    );
  }

  // ── Real video preview ──
  if (isVideo && !loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black"
           style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
        <video controls src={url} className="max-w-full max-h-full" onError={() => setLoadError(true)}>
          Your browser does not support the video element.
        </video>
      </div>
    );
  }

  // ── Real text/data preview ──
  if (isText && textContent !== null) {
    return (
      <div className="w-full h-full overflow-auto bg-background p-4"
           style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span className="font-mono">{file.filename}</span>
          <span>·</span>
          <span>{(file.size_kb / 1024).toFixed(1)} MB</span>
        </div>
        <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/40 rounded-lg p-4 max-h-[calc(100%-3rem)] overflow-auto border">
          {textContent.slice(0, 50_000)}{textContent.length > 50_000 ? "\n\n… (truncated)" : ""}
        </pre>
      </div>
    );
  }
  if (isText && textLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── Fallback placeholder (seed data or unsupported type) ──
  const Icon = fileIcon(ext);
  const bgClass = isImage ? "from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-700 dark:text-green-300"
    : isAudio ? "from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 text-purple-700 dark:text-purple-300"
    : "from-slate-100 to-slate-200 dark:from-slate-800/30 dark:to-slate-700/30 text-muted-foreground";

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${bgClass}`}
         style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
      <Icon className="h-16 w-16 opacity-40" />
      <span className="font-mono text-sm opacity-70">{file.filename}</span>
      <span className="text-xs text-muted-foreground">{(file.size_kb / 1024).toFixed(1)} MB</span>
      <span className="text-[10px] text-muted-foreground/60 mt-1">No preview available — file content not stored</span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────
export default function AnnotatePage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const mission = store.getMission(id ?? "");
  const userRole = mission ? store.getUserRole(mission.id) : undefined;
  const tasks = useMemo(
    () => (mission ? resolveAnnotationTemplates(mission) : []),
    [mission],
  );
  const files = mission ? store.getFilesNeedingAnnotation(mission.id) : [];
  const modelTypeInfo = mission ? MODEL_TYPES[mission.model_type] : null;

  const [fileIndex, setFileIndex] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [responses, setResponses] = useState<
    Record<string, Record<string, AnnotationValue>>
  >({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const currentFile = files[fileIndex] ?? null;
  const currentTask = tasks[taskIndex] ?? null;
  const totalFiles = files.length;

  const fileResponses = useMemo(
    () => (currentFile ? responses[currentFile.id] ?? {} : {}),
    [responses, currentFile],
  );

  const setTaskValue = useCallback(
    (taskKey: string, value: AnnotationValue) => {
      if (!currentFile) return;
      setResponses((prev) => ({
        ...prev,
        [currentFile.id]: {
          ...(prev[currentFile.id] ?? {}),
          [taskKey]: value,
        },
      }));
    },
    [currentFile],
  );

  const handleNext = () => {
    if (taskIndex < tasks.length - 1) setTaskIndex(taskIndex + 1);
  };

  const handlePrev = () => {
    if (taskIndex > 0) setTaskIndex(taskIndex - 1);
  };

  const handleSubmit = () => {
    if (!currentFile || !mission) return;
    // Persist annotation responses to store
    const fileResp = responses[currentFile.id] ?? {};
    store.saveAnnotationResponses(mission.id, currentFile.id, fileResp);
    setCompleted((prev) => new Set([...prev, currentFile.id]));
    if (fileIndex < totalFiles - 1) {
      setFileIndex(fileIndex + 1);
      setTaskIndex(0);
    }
  };

  const handleSkip = () => {
    if (fileIndex < totalFiles - 1) {
      setFileIndex(fileIndex + 1);
      setTaskIndex(0);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      switch (e.key) {
        case "ArrowRight":
          handleNext();
          break;
        case "ArrowLeft":
          handlePrev();
          break;
        case "ArrowDown":
          e.preventDefault();
          if (fileIndex < totalFiles - 1) {
            setFileIndex(fileIndex + 1);
            setTaskIndex(0);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (fileIndex > 0) {
            setFileIndex(fileIndex - 1);
            setTaskIndex(0);
          }
          break;
        case "Enter":
          if (allTasksAnswered) handleSubmit();
          break;
        case "s":
        case "S":
          handleSkip();
          break;
        case "=":
        case "+":
          setZoom((z) => Math.min(z + 0.25, 3));
          break;
        case "-":
          setZoom((z) => Math.max(z - 0.25, 0.5));
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (!mission) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <p className="text-lg font-medium">Mission not found</p>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Missions
          </Link>
        </Button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 opacity-60" />
        <h2 className="text-xl font-semibold">All caught up!</h2>
        <p className="text-muted-foreground">
          No files need annotation for this mission right now.
        </p>
        <Button variant="outline" asChild>
          <Link to={`/app/missions/${mission.id}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Mission
          </Link>
        </Button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-4">
        <AlertCircle className="h-12 w-12 mx-auto text-amber-500 opacity-60" />
        <h2 className="text-xl font-semibold">No tasks configured</h2>
        <p className="text-muted-foreground">
          This mission doesn't have annotation tasks set up yet.
        </p>
        <Button variant="outline" asChild>
          <Link to={`/app/missions/${mission.id}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Mission
          </Link>
        </Button>
      </div>
    );
  }

  const pctDone = Math.round((completed.size / totalFiles) * 100);
  const allTasksAnswered = tasks.every(
    (t) => !t.required || fileResponses[t.key] != null,
  );

  // Count how many tasks have values for current file
  const answeredCount = tasks.filter(
    (t) => fileResponses[t.key] != null,
  ).length;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* ─── Top bar ─── */}
      <div className="flex items-center gap-3 border-b px-4 py-2 bg-background shrink-0">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs">
          <Link to={`/app/missions/${mission.id}`}>
            <ArrowLeft className="h-3.5 w-3.5" />
            {mission.title}
          </Link>
        </Button>
        <Separator orientation="vertical" className="h-4" />

        {/* Model type badge */}
        {modelTypeInfo && (
          <Badge
            variant="secondary"
            className={`text-[10px] px-2 py-0.5 ${modelTypeInfo.bgColor}`}
          >
            {modelTypeInfo.emoji} {modelTypeInfo.label}
          </Badge>
        )}

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-muted-foreground">
            File {fileIndex + 1}/{totalFiles}
          </span>
          <Progress value={pctDone} className="h-1.5 flex-1 max-w-[200px]" />
          <span className="text-xs font-medium tabular-nums">{pctDone}%</span>
        </div>

        <Badge variant="outline" className="text-[10px] px-2 py-0.5">
          <Layers className="h-3 w-3 mr-1" />
          {answeredCount}/{tasks.length} tasks
        </Badge>

        {(userRole === "reviewer" || (mission && store.user && mission.owner_id === store.user.id)) && (
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Shield className="h-3 w-3 mr-1" />
            Reviewer
          </Badge>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setShowShortcuts(!showShortcuts)}
            title="Keyboard shortcuts"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setZoom(1)}
            title="Reset zoom"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── Shortcuts help ─── */}
      {showShortcuts && (
        <div className="border-b bg-muted/40 px-4 py-2 flex items-center gap-6 text-xs text-muted-foreground shrink-0">
          <span className="font-medium text-foreground flex items-center gap-1">
            <Keyboard className="h-3 w-3" /> Shortcuts
          </span>
          <span>← → Navigate tasks</span>
          <span>↑ ↓ Navigate files</span>
          <span>Enter Submit</span>
          <span>S Skip file</span>
          <span>+ / − Zoom</span>
        </div>
      )}

      {/* ─── Main split view ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT — Media viewer */}
        <div className="flex-1 relative overflow-hidden bg-muted/20">
          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setZoom(1)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* File content */}
          {currentFile && <MediaPreview file={currentFile} zoom={zoom} />}

          {/* File info footer */}
          {currentFile && (
            <div className="absolute bottom-0 inset-x-0 bg-background/80 backdrop-blur border-t px-4 py-2 flex items-center gap-3 text-xs">
              {(() => {
                const Icon = fileIcon(currentFile.type);
                return <Icon className="h-3.5 w-3.5 text-muted-foreground" />;
              })()}
              <span className="font-mono truncate">{currentFile.filename}</span>
              <span className="text-muted-foreground">
                {(currentFile.size_kb / 1024).toFixed(1)} MB
              </span>
              <span className="text-muted-foreground">
                by {currentFile.contributor_name}
              </span>
            </div>
          )}
        </div>

        {/* RIGHT — Task panel */}
        <div className="w-[440px] border-l flex flex-col bg-background shrink-0">
          {/* Task navigation */}
          <div className="border-b px-4 py-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">
                  Task {taskIndex + 1} of {tasks.length}
                </span>
                {currentTask?.required && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 border-red-300 text-red-600"
                  >
                    Required
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={taskIndex === 0}
                  onClick={handlePrev}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={taskIndex === tasks.length - 1}
                  onClick={handleNext}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {/* Task dots */}
            <div className="flex gap-1">
              {tasks.map((t, i) => {
                const answered = fileResponses[t.key] != null;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTaskIndex(i)}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      i === taskIndex
                        ? "bg-primary"
                        : answered
                          ? "bg-green-500"
                          : "bg-muted-foreground/20"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Current task content */}
          {currentTask && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Task header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">
                    {currentTask.template.emoji}
                  </span>
                  <h3 className="font-semibold text-[15px]">
                    {currentTask.title}
                  </h3>
                </div>
                <p className="text-[13px] text-muted-foreground leading-snug">
                  {currentTask.instruction}
                </p>
                <Badge
                  variant="secondary"
                  className="text-[10px] mt-2 px-2 py-0.5"
                >
                  {currentTask.template.label}
                </Badge>
              </div>

              <Separator />

              {/* ─── Render task-type-specific component ─── */}
              <TaskRenderer
                template={currentTask.template}
                filename={currentFile?.filename ?? "unknown"}
                value={fileResponses[currentTask.key] ?? null}
                onChange={(val) => setTaskValue(currentTask.key, val)}
              />

              {/* Help */}
              <div className="pt-2">
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <HelpCircle className="h-3 w-3" />
                  Need help with this task?
                </button>
              </div>
            </div>
          )}

          {/* Bottom actions */}
          <div className="border-t px-4 py-3 flex items-center gap-2 bg-background shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="gap-1.5 text-xs text-muted-foreground"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip
            </Button>
            <div className="flex-1" />
            {taskIndex < tasks.length - 1 ? (
              <Button size="sm" onClick={handleNext} className="gap-1.5">
                Next Task
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!allTasksAnswered}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Submit & Next
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── File strip at bottom ─── */}
      <div className="border-t bg-background px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0"
          disabled={fileIndex === 0}
          onClick={() => {
            setFileIndex(fileIndex - 1);
            setTaskIndex(0);
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {files.map((f, i) => {
          const Icon = fileIcon(f.type);
          const done = completed.has(f.id);
          return (
            <button
              key={f.id}
              onClick={() => {
                setFileIndex(i);
                setTaskIndex(0);
              }}
              className={`shrink-0 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-all ${
                i === fileIndex
                  ? "border-primary bg-primary/5 text-primary"
                  : done
                    ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400"
                    : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
              <span className="max-w-[80px] truncate font-mono">
                {f.filename}
              </span>
            </button>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0"
          disabled={fileIndex === totalFiles - 1}
          onClick={() => {
            setFileIndex(fileIndex + 1);
            setTaskIndex(0);
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
