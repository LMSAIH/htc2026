import { useState, useMemo, useCallback } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  getMissionById,
  getTasksForMission,
  getFilesNeedingAnnotation,
  type DataFile,
} from "@/lib/mock-data";

// ─── Helpers ─────────────────────────────────────────────────────────
function fileIcon(ext: string) {
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return ImageIcon;
  if ([".mp3", ".wav", ".ogg", ".flac"].includes(ext)) return Music;
  if ([".csv", ".json", ".xlsx"].includes(ext)) return FileSpreadsheet;
  return FileText;
}

function fakeThumbnail(file: DataFile) {
  const ext = file.type.toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 flex flex-col items-center justify-center gap-2 text-green-700 dark:text-green-300">
        <ImageIcon className="h-16 w-16 opacity-40" />
        <span className="font-mono text-sm opacity-70">{file.filename}</span>
        <span className="text-xs text-muted-foreground">
          {(file.size_kb / 1024).toFixed(1)} MB
        </span>
      </div>
    );
  }
  if ([".mp3", ".wav", ".ogg", ".flac"].includes(ext)) {
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 flex flex-col items-center justify-center gap-3 text-purple-700 dark:text-purple-300">
        <Music className="h-16 w-16 opacity-40" />
        <span className="font-mono text-sm opacity-70">{file.filename}</span>
        <div className="flex items-center gap-1">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-purple-400/60 dark:bg-purple-400/40"
              style={{ height: `${12 + Math.random() * 36}px` }}
            />
          ))}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs mt-1">
          ▶ Play Audio
        </Button>
      </div>
    );
  }
  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/30 dark:to-slate-700/30 flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <FileSpreadsheet className="h-16 w-16 opacity-40" />
      <span className="font-mono text-sm opacity-70">{file.filename}</span>
      <span className="text-xs">Data preview not available</span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────
export default function AnnotatePage() {
  const { id } = useParams<{ id: string }>();
  const mission = getMissionById(id ?? "");
  const tasks = mission ? getTasksForMission(mission.id) : [];
  const files = mission ? getFilesNeedingAnnotation(mission.id) : [];

  const [fileIndex, setFileIndex] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, Record<string, string | string[] | number>>>({});
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
    (taskId: string, value: string | string[] | number) => {
      if (!currentFile) return;
      setResponses((prev) => ({
        ...prev,
        [currentFile.id]: { ...(prev[currentFile.id] ?? {}), [taskId]: value },
      }));
    },
    [currentFile],
  );

  const handleNext = () => {
    if (taskIndex < tasks.length - 1) {
      setTaskIndex(taskIndex + 1);
    }
  };

  const handlePrev = () => {
    if (taskIndex > 0) {
      setTaskIndex(taskIndex - 1);
    }
  };

  const handleSubmit = () => {
    if (!currentFile) return;
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

  const pctDone = Math.round(((completed.size) / totalFiles) * 100);
  const allTasksAnswered = tasks.every(
    (t) => !t.required || fileResponses[t.id] !== undefined,
  );

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
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-muted-foreground">
            File {fileIndex + 1} of {totalFiles}
          </span>
          <Progress value={pctDone} className="h-1.5 flex-1 max-w-[200px]" />
          <span className="text-xs font-medium tabular-nums">{pctDone}%</span>
        </div>
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
          <span>1-9 Quick select option</span>
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
          <div
            className="w-full h-full flex items-center justify-center overflow-auto"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          >
            {currentFile && fakeThumbnail(currentFile)}
          </div>

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
              <span className="text-muted-foreground">by {currentFile.contributor_name}</span>
            </div>
          )}
        </div>

        {/* RIGHT — Task panel */}
        <div className="w-[400px] border-l flex flex-col bg-background shrink-0">
          {/* Task navigation */}
          <div className="border-b px-4 py-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">
                Task {taskIndex + 1} of {tasks.length}
              </span>
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
                const answered = fileResponses[t.id] !== undefined;
                return (
                  <button
                    key={t.id}
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
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-[15px]">{currentTask.title}</h3>
                  {currentTask.required && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Required
                    </Badge>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground leading-snug">
                  {currentTask.instruction}
                </p>
              </div>

              <Separator />

              {/* ─── Single choice ─── */}
              {currentTask.type === "single_choice" && currentTask.options && (
                <div className="space-y-2">
                  {currentTask.options.map((opt, idx) => {
                    const selected = fileResponses[currentTask.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setTaskValue(currentTask.id, opt.id)}
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
                            {selected && (
                              <div className="h-2 w-2 rounded-full bg-white" />
                            )}
                          </div>
                          <div>
                            <span className="text-[13px] font-medium">
                              <span className="text-muted-foreground mr-1.5 font-mono text-[11px]">
                                {idx + 1}
                              </span>
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
              )}

              {/* ─── Multiple choice ─── */}
              {currentTask.type === "multiple_choice" && currentTask.options && (
                <div className="space-y-2">
                  {currentTask.options.map((opt, idx) => {
                    const selectedValues = (fileResponses[currentTask.id] as string[]) ?? [];
                    const checked = selectedValues.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          const newVal = checked
                            ? selectedValues.filter((v) => v !== opt.id)
                            : [...selectedValues, opt.id];
                          setTaskValue(currentTask.id, newVal);
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
                            {checked && (
                              <CheckCircle2 className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div>
                            <span className="text-[13px] font-medium">
                              <span className="text-muted-foreground mr-1.5 font-mono text-[11px]">
                                {idx + 1}
                              </span>
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
              )}

              {/* ─── Number ─── */}
              {currentTask.type === "number" && (
                <div className="space-y-3">
                  <Input
                    type="number"
                    min={currentTask.min}
                    max={currentTask.max}
                    value={(fileResponses[currentTask.id] as number) ?? ""}
                    onChange={(e) =>
                      setTaskValue(currentTask.id, Number(e.target.value))
                    }
                    placeholder={`${currentTask.min ?? 0} – ${currentTask.max ?? 100}`}
                    className="text-center text-lg font-mono h-12"
                  />
                  {currentTask.min !== undefined && currentTask.max !== undefined && (
                    <div className="flex justify-between text-xs text-muted-foreground px-1">
                      <span>{currentTask.min}</span>
                      <span>{currentTask.max}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Free text ─── */}
              {currentTask.type === "free_text" && (
                <Textarea
                  value={(fileResponses[currentTask.id] as string) ?? ""}
                  onChange={(e) => setTaskValue(currentTask.id, e.target.value)}
                  placeholder={currentTask.placeholder ?? "Type your answer…"}
                  rows={4}
                  className="text-[13px]"
                />
              )}

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
              <span className="max-w-[80px] truncate font-mono">{f.filename}</span>
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
