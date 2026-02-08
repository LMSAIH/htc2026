import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  FileText,
  FileUp,
  Users,
  CheckCircle2,
  XCircle,
  Tag,
  Sparkles,
  Database,
  Download,
  Pencil,
  Send,
  Play,
  Copy,
  Heart,
  ExternalLink,
  Info,
  Zap,
  Box,
  Plus,
  Trash2,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AnimatedProgress } from "@/components/ui/animated-progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  getRoleLabel,
  MODEL_TYPES,
  type DataFile,
  type TrainedModel,
  type MissionTaskConfig,
} from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import {
  resolveAnnotationTemplates,
} from "@/lib/mock-data";
import {
  getTemplatesForModelType,
  CATEGORY_LABELS,
  groupTemplatesByCategory,
  getRecommendedTemplates,
  type AnnotationTaskType,
} from "@/lib/annotation-tasks";

// ─── Helpers ─────────────────────────────────────────────────────────
function statusBadge(s: DataFile["status"]) {
  const map = {
    approved: { label: "Integrated", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    pending: { label: "Upload pending", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
    needs_annotation: { label: "Needs annotation", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    pending_review: { label: "Awaiting review", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  } as const;
  const { label, cls } = map[s];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

function formatSize(kb: number) {
  return kb >= 1000 ? `${(kb / 1000).toFixed(1)} MB` : `${kb} KB`;
}
function formatSizeMb(mb: number) {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Agriculture: "🌾",
  Environment: "🌍",
  Languages: "🗣️",
  "Public Health": "💧",
  Conservation: "🐾",
};

// ─── Page ────────────────────────────────────────────────────────────
export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const mission = store.getMission(id ?? "");
  const models = mission ? store.getModels(mission.id) : [];
  const userRole = mission ? store.getUserRole(mission.id) : undefined;

  const [tab, setTab] = useState("readme");

  // Upload
  const [dragOver, setDragOver] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  // Annotate dialog
  const [annotateFile, setAnnotateFile] = useState<DataFile | null>(null);
  const [annotationLabel, setAnnotationLabel] = useState("");
  const [annotationNotes, setAnnotationNotes] = useState("");

  // Review dialog
  const [reviewFile, setReviewFile] = useState<DataFile | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  // Model playground
  const [selectedModel, setSelectedModel] = useState<TrainedModel | null>(null);
  const [modelInput, setModelInput] = useState("");
  const [modelResult, setModelResult] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);

  // Task management (reviewer)
  const [showTaskManager, setShowTaskManager] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!mission) return;
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        mission.accepted_types.some((ext) => f.name.toLowerCase().endsWith(ext)),
      );
      setUploadFiles((prev) => [...prev, ...files]);
    },
    [mission],
  );

  const handleUpload = () => {
    if (!mission || uploadFiles.length === 0) return;
    setUploading(true);
    const targetDataset = mission.datasets[0];
    if (!targetDataset) return;
    setTimeout(() => {
      store.uploadFiles(
        mission.id,
        targetDataset.id,
        uploadFiles.map((f) => ({ name: f.name, size: f.size, type: f.type })),
      );
      setUploading(false);
      setUploadDone(true);
      setUploadFiles([]);
      setTimeout(() => setUploadDone(false), 4000);
    }, 800);
  };

  const handleModelRun = (model: TrainedModel) => {
    setModelLoading(true);
    setModelResult(null);
    setTimeout(() => {
      setModelResult(model.output_example);
      setModelLoading(false);
    }, 1800);
  };

  if (!mission) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <p className="text-lg font-medium">Mission not found</p>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Missions</Link>
        </Button>
      </div>
    );
  }

  const pct = Math.round((mission.current_contributions / mission.target_contributions) * 100);
  const mt = MODEL_TYPES[mission.model_type];
  const allFiles = mission.datasets.flatMap((d) => d.sample_files);
  const uploadQueue = allFiles.filter((f) => f.status === "pending");
  const annotationQueue = allFiles.filter((f) => f.status === "needs_annotation");
  const reviewQueue = allFiles.filter((f) => f.status === "pending_review");
  const integratedFiles = allFiles.filter((f) => f.status === "approved");
  const needsAnnotation = annotationQueue;
  const totalFileCount = mission.datasets.reduce((s, d) => s + d.file_count, 0);
  const totalSize = mission.datasets.reduce((s, d) => s + d.total_size_mb, 0);

  // ─── Build available tabs ──────────────────────────────────────────
  const tabConfig = [
    { value: "readme", label: "README", icon: FileText, always: true },
    { value: "files", label: `Files (${mission.datasets.length})`, icon: Database, always: true },
    { value: "models", label: `Models (${models.length})`, icon: Box, always: models.length > 0 },
    { value: "contribute", label: "Contribute", icon: Upload, always: true },
    { value: "annotate", label: "Annotate", icon: Pencil, always: userRole === "annotator" || userRole === "reviewer" },
    { value: "review", label: "Review", icon: CheckCircle2, always: userRole === "reviewer" },
  ].filter((t) => t.always);

  return (
    <div className="max-w-4xl mx-auto space-y-0">
      {/* ─── Breadcrumb-style header ─── */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-4">
        <Link to="/app" className="hover:text-foreground transition-colors">
          Missions
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{mission.title}</span>
      </div>

      {/* ─── HF-style title block ─── */}
      <div className="border rounded-xl overflow-hidden bg-card">
        {/* Title row */}
        <div className="px-5 pt-5 pb-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xl">
                  {CATEGORY_EMOJI[mission.category] ?? "📁"}
                </span>
                <h1 className="font-mission-title tracking-tight">{mission.title}</h1>
                {mission.status === "completed" ? (
                  <Badge variant="outline" className="text-green-600 border-green-300 text-[11px]">
                    Complete
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-blue-600 border-blue-300 text-[11px]">
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-[13px] text-muted-foreground">
                by <span className="font-medium text-foreground">{mission.owner_name}</span>
                {" · "}
                {mission.category}
                {" · "}
                <span className={`inline-inline items-center gap-1 font-medium ${mt.color}`}>
                  {mt.emoji} {mt.label}
                </span>
                {userRole && (
                  <>
                    {" · "}
                    <span className="text-primary font-medium">
                      You're a {getRoleLabel(userRole).toLowerCase()}
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant={store.likedMissions.has(mission.id) ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => store.toggleLike(mission.id)}
              >
                <Heart className={`h-3.5 w-3.5 ${store.likedMissions.has(mission.id) ? "fill-current" : ""}`} />
                {store.likedMissions.has(mission.id) ? "Liked" : "Like"}
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => setTab("contribute")}
              >
                <Upload className="h-3.5 w-3.5" /> Contribute
              </Button>
            </div>
          </div>

          {/* Stat chips  */}
          <div className="flex items-center gap-3 flex-wrap text-[12px]">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <FileUp className="h-3 w-3" /> {totalFileCount.toLocaleString()} files
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Download className="h-3 w-3" /> {formatSizeMb(totalSize)}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Users className="h-3 w-3" /> {mission.contributors.length} members
            </span>
            {models.length > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                <Sparkles className="h-3 w-3" /> {models.length} trained model{models.length > 1 ? "s" : ""}
              </span>
            )}
            <div className="flex items-center gap-1.5 ml-auto">
              {mission.accepted_types.map((t) => (
                <span key={t} className="rounded bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <AnimatedProgress value={pct} className="h-2 flex-1" />
            <span className="text-[12px] text-muted-foreground tabular-nums shrink-0">
              {mission.current_contributions.toLocaleString()} / {mission.target_contributions.toLocaleString()} ({pct}%)
            </span>
          </div>
        </div>

        {/* Tab bar — inside the header card similar to HF */}
        <div className="border-t bg-muted/30 px-5">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto bg-transparent gap-0 p-0 rounded-none">
              {tabConfig.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-[13px] gap-1.5"
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* ─── Tab content ─── */}
      <div className="pt-5">
        <Tabs value={tab} onValueChange={setTab}>
          {/* README */}
          <TabsContent value="readme" className="mt-0 space-y-5">
            {/* Mission card — README style */}
            <div className="prose prose-sm dark:prose-invert max-w-none border rounded-xl p-6 bg-card">
              <h2 className="flex items-center gap-2 text-lg font-semibold mt-0!">
                <Info className="h-4.5 w-4.5 text-primary" />
                Why this mission matters
              </h2>
              <p className="text-[14px] leading-relaxed text-muted-foreground">{mission.reason}</p>

              <Separator className="my-5" />

              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <FileText className="h-4.5 w-4.5 text-primary" />
                About
              </h2>
              <p className="text-[14px] leading-relaxed">{mission.description}</p>

              <Separator className="my-5" />

              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Zap className="h-4.5 w-4.5 text-primary" />
                How to contribute
              </h2>
              <div className="text-[14px] whitespace-pre-line leading-relaxed">
                {mission.how_to_contribute}
              </div>
            </div>

            {/* Team sidebar-style section */}
            <div className="border rounded-xl p-5 bg-card space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Team ({mission.contributors.length})
              </h3>
              <div className="flex flex-wrap gap-3">
                {mission.contributors.map((c) => (
                  <div
                    key={c.user_id}
                    className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary">
                      {c.user_name.split(" ").map((w) => w[0]).join("")}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium leading-tight">{c.user_name}</p>
                      <p className="text-[11px] text-muted-foreground">{getRoleLabel(c.role)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* FILES / DATASETS */}
          <TabsContent value="files" className="mt-0 space-y-4">
            {mission.datasets.map((ds) => (
              <div key={ds.id} className="border rounded-xl bg-card overflow-hidden">
                <div className="px-5 py-4 border-b bg-muted/20 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[15px]">{ds.name}</h3>
                    <p className="text-[13px] text-muted-foreground mt-0.5">{ds.description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-[12px] text-muted-foreground space-y-0.5">
                      <p>{ds.file_count.toLocaleString()} files</p>
                      <p>{formatSizeMb(ds.total_size_mb)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-[12px]"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`Downloading "${ds.name}" (${formatSizeMb(ds.total_size_mb)}) — this is a demo, in production this would fetch from your storage bucket.`);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
                <div className="divide-y">
                  {ds.sample_files.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-mono text-[13px] truncate flex-1 min-w-0">{f.filename}</span>
                      <span className="text-[12px] text-muted-foreground shrink-0">{formatSize(f.size_kb)}</span>
                      <span className="text-[12px] text-muted-foreground shrink-0">{f.contributor_name}</span>
                      {statusBadge(f.status)}
                      <button
                        className="rounded p-1 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title={`Download ${f.filename}`}
                        onClick={(e) => {
                          e.preventDefault();
                          alert(`Downloading "${f.filename}" (${formatSize(f.size_kb)}) — demo only.`);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-2.5 border-t bg-muted/10">
                  <p className="text-[12px] text-muted-foreground">
                    Showing {ds.sample_files.length} of {ds.file_count.toLocaleString()} files · Accepted: {ds.accepted_types.join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* MODELS */}
          {models.length > 0 && (
            <TabsContent value="models" className="mt-0 space-y-4">
              <p className="text-[14px] text-muted-foreground">
                Trained models built on this mission's datasets. Try them out or use the API.
              </p>

              {models.map((model) => (
                <div key={model.id} className="border rounded-xl bg-card overflow-hidden">
                  {/* Model header */}
                  <div className="px-5 py-4 flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-[15px] font-mono">{model.name}</h3>
                        <Badge
                          variant="outline"
                          className={`text-[11px] px-1.5 py-0 ${
                            model.status === "online"
                              ? "text-green-600 border-green-300"
                              : model.status === "training"
                              ? "text-yellow-600 border-yellow-300"
                              : "text-gray-500 border-gray-300"
                          }`}
                        >
                          {model.status}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{model.version}</span>
                      </div>
                      <p className="text-[13px] text-muted-foreground leading-snug">{model.description}</p>
                      <div className="flex items-center gap-3 text-[12px] text-muted-foreground pt-0.5">
                        <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> {model.task}</span>
                        <span>{model.framework}</span>
                        <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {model.downloads.toLocaleString()}</span>
                        <span>Accuracy: <strong className="text-foreground">{model.accuracy}%</strong></span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5"
                      disabled={model.status !== "online"}
                      onClick={() => {
                        setSelectedModel(model);
                        setModelInput("");
                        setModelResult(null);
                      }}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Try it
                    </Button>
                  </div>

                  {/* Inline playground when selected */}
                  {selectedModel?.id === model.id && (
                    <div className="border-t px-5 py-4 bg-muted/20 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[13px]">{model.input_example}</Label>
                        <Textarea
                          placeholder="Enter your input here…"
                          value={modelInput}
                          onChange={(e) => setModelInput(e.target.value)}
                          rows={3}
                          className="font-mono text-[13px]"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          disabled={!modelInput.trim() || modelLoading}
                          onClick={() => handleModelRun(model)}
                          className="gap-1.5"
                        >
                          {modelLoading ? "Running…" : <><Send className="h-3.5 w-3.5" /> Run</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            document.getElementById("model-file-input")?.click();
                          }}
                          className="gap-1.5 text-xs"
                        >
                          <Upload className="h-3.5 w-3.5" /> Upload file
                        </Button>
                        <input
                          id="model-file-input"
                          type="file"
                          className="hidden"
                          accept={mission.accepted_types.join(",")}
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setModelInput(`[File: ${e.target.files[0].name}]`);
                            }
                          }}
                        />
                      </div>
                      {modelResult && (
                        <div className="relative">
                          <pre className="rounded-lg bg-background border p-4 font-mono text-[13px] whitespace-pre-wrap overflow-x-auto">
                            {modelResult}
                          </pre>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 h-7 w-7 p-0"
                            onClick={() => navigator.clipboard.writeText(modelResult)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* API snippet */}
                  <div className="border-t px-5 py-3 bg-muted/10">
                    <details className="group">
                      <summary className="text-[12px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1.5">
                        <ExternalLink className="h-3 w-3" />
                        API Usage
                      </summary>
                      <pre className="mt-2 rounded-lg bg-background border p-3 font-mono text-[12px] whitespace-pre overflow-x-auto">
{`curl -X POST https://api.dataforall.org/v1/models/${model.id}/predict \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@input${mission.accepted_types[0]}"`}
                      </pre>
                    </details>
                  </div>
                </div>
              ))}
            </TabsContent>
          )}

          {/* CONTRIBUTE — simplified, friendly */}
          <TabsContent value="contribute" className="mt-0 space-y-5">
            <div className="border rounded-xl bg-card overflow-hidden">
              <div className="px-5 py-4 border-b bg-muted/20">
                <h3 className="font-semibold text-[15px]">Upload your data</h3>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Anyone can contribute — no coding or data science skills needed.
                  Just follow the steps below.
                </p>
              </div>

              <div className="p-5 space-y-5">
                {/* Step-by-step guidance */}
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { step: 1, title: "Prepare your file", desc: `Accepted: ${mission.accepted_types.join(", ")}` },
                    { step: 2, title: "Drop it below", desc: "Drag & drop or click to browse" },
                    { step: 3, title: "That's it!", desc: "Our team reviews and labels it" },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[13px] font-bold text-primary shrink-0">
                        {s.step}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium">{s.title}</p>
                        <p className="text-[12px] text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Drop zone */}
                <div
                  className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-all cursor-pointer ${
                    dragOver
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-[14px]">Drop files here or click to browse</p>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    {mission.accepted_types.join(", ")} — up to 50 MB per file
                  </p>
                </div>
                <input
                  id="file-input"
                  type="file"
                  multiple
                  className="hidden"
                  accept={mission.accepted_types.join(",")}
                  onChange={(e) => {
                    if (e.target.files) setUploadFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }}
                />

                {/* File list */}
                {uploadFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-[13px] truncate flex-1">{f.name}</span>
                        <span className="text-[12px] text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                        <button
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadFiles((prev) => prev.filter((_, idx) => idx !== i));
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <Button onClick={handleUpload} disabled={uploading} className="w-full gap-2">
                      <Upload className="h-4 w-4" />
                      {uploading ? "Uploading…" : `Upload ${uploadFiles.length} file${uploadFiles.length > 1 ? "s" : ""}`}
                    </Button>
                  </div>
                )}

                {uploadDone && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-[14px] font-medium text-green-700 dark:text-green-300">Upload successful!</p>
                      <p className="text-[12px] text-green-600 dark:text-green-400">
                        Your files are queued for review. Thank you for contributing!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Expandable How-to */}
            <details className="border rounded-xl bg-card overflow-hidden group">
              <summary className="px-5 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors text-[14px] font-medium flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                Detailed contribution guidelines
              </summary>
              <div className="px-5 pb-4 text-[14px] text-muted-foreground whitespace-pre-line leading-relaxed border-t pt-4">
                {mission.how_to_contribute}
              </div>
            </details>
          </TabsContent>

          {/* ANNOTATE */}
          {(userRole === "annotator" || userRole === "reviewer") && (
            <TabsContent value="annotate" className="mt-0 space-y-4">
              {/* Start Annotating CTA */}
              {needsAnnotation.length > 0 && (
                <div className="border rounded-xl bg-primary/5 border-primary/20 p-5 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-[15px]">Ready to annotate?</h3>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      {needsAnnotation.length} file{needsAnnotation.length !== 1 ? "s" : ""} waiting · {resolveAnnotationTemplates(mission).length} tasks per file
                    </p>
                  </div>
                  <Link to={`/app/missions/${mission.id}/annotate`}>
                    <Button className="gap-1.5">
                      <Pencil className="h-4 w-4" />
                      Start Annotating
                    </Button>
                  </Link>
                </div>
              )}

              {/* Task preview — uses new template system if available */}
              {(() => {
                const newTasks = resolveAnnotationTemplates(mission);
                if (newTasks.length > 0) {
                  return (
                    <div className="border rounded-xl bg-card overflow-hidden">
                      <div className="px-5 py-3.5 border-b bg-muted/20">
                        <h3 className="font-semibold text-[14px]">Annotation Tasks</h3>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Each file goes through these {newTasks.length} annotation tasks
                        </p>
                      </div>
                      <div className="divide-y">
                        {newTasks.map((task, i) => (
                          <div key={task.key} className="px-5 py-3 flex items-start gap-3">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 mt-0.5">
                              {i + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{task.template.emoji}</span>
                                <p className="text-[13px] font-medium">{task.title}</p>
                                {task.required && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-600">Required</Badge>
                                )}
                              </div>
                              <p className="text-[12px] text-muted-foreground">{task.instruction}</p>
                              <Badge variant="secondary" className="text-[10px] mt-1 px-1.5 py-0">
                                {task.template.label}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                // Fallback: no configured tasks
                return (
                  <div className="border rounded-xl bg-card p-6 text-center text-muted-foreground">
                    <p className="text-[14px] font-medium">No annotation tasks configured</p>
                    <p className="text-[13px] mt-1">
                      {userRole === "reviewer"
                        ? "Set up annotation tasks in the Review tab to enable the annotation workflow."
                        : "The mission reviewer hasn't configured annotation tasks yet."}
                    </p>
                  </div>
                );
              })()}

              <div className="border rounded-xl bg-card overflow-hidden">
                <div className="px-5 py-4 border-b bg-muted/20 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[15px]">Annotation Queue</h3>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      {needsAnnotation.length} file{needsAnnotation.length !== 1 ? "s" : ""} waiting for labels
                    </p>
                  </div>
                </div>
                {needsAnnotation.length === 0 ? (
                  <div className="px-5 py-10 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-[14px] font-medium">All caught up!</p>
                    <p className="text-[13px]">No files need annotation right now.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {needsAnnotation.map((f) => {
                      const ds = mission.datasets.find((d) => d.sample_files.some((sf) => sf.id === f.id));
                      return (
                        <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-[13px] truncate">{f.filename}</p>
                            <p className="text-[11px] text-muted-foreground">{ds?.name} · by {f.contributor_name}</p>
                          </div>
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0" onClick={() => setAnnotateFile(f)}>
                            <Pencil className="h-3 w-3" /> Label
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recently annotated */}
              {allFiles.some((f) => f.annotations?.length) && (
                <div className="border rounded-xl bg-card overflow-hidden">
                  <div className="px-5 py-3.5 border-b bg-muted/20">
                    <h3 className="font-semibold text-[14px]">Recently Annotated</h3>
                  </div>
                  <div className="divide-y">
                    {allFiles
                      .filter((f) => f.annotations && f.annotations.length > 0)
                      .slice(0, 5)
                      .map((f) => (
                        <div key={f.id} className="px-5 py-3">
                          <p className="font-mono text-[13px]">{f.filename}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {f.annotations!.map((a) => (
                              <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                <Tag className="h-2.5 w-2.5" /> {a.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          {/* REVIEW */}
          {userRole === "reviewer" && (
            <TabsContent value="review" className="mt-0 space-y-4">
              {/* Pipeline Stats */}
              <div className="grid grid-cols-5 gap-2">
                <div className="border rounded-xl bg-card px-3 py-2.5 text-center">
                  <p className="text-lg font-bold text-yellow-600">{uploadQueue.length}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Uploads<br />Pending</p>
                </div>
                <div className="border rounded-xl bg-card px-3 py-2.5 text-center">
                  <p className="text-lg font-bold text-blue-600">{annotationQueue.length}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Needs<br />Annotation</p>
                </div>
                <div className="border rounded-xl bg-card px-3 py-2.5 text-center">
                  <p className="text-lg font-bold text-violet-600">{reviewQueue.length}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Awaiting<br />Review</p>
                </div>
                <div className="border rounded-xl bg-card px-3 py-2.5 text-center">
                  <p className="text-lg font-bold text-green-600">{integratedFiles.length}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Integrated</p>
                </div>
                <div className="border rounded-xl bg-card px-3 py-2.5 text-center">
                  <p className="text-lg font-bold text-red-600">{allFiles.filter((f) => f.status === "rejected").length}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Rejected</p>
                </div>
              </div>

              {/* Pipeline flow indicator */}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-4 py-2.5">
                <span className="font-medium text-yellow-600">Upload</span>
                <span>→</span>
                <span className="font-medium text-foreground">Approve</span>
                <span>→</span>
                <span className="font-medium text-blue-600">Annotate</span>
                <span>→</span>
                <span className="font-medium text-foreground">Review</span>
                <span>→</span>
                <span className="font-medium text-green-600">Integrated</span>
              </div>

              {/* Manage Annotation Tasks */}
              <div className="border rounded-xl bg-card overflow-hidden">
                <div className="px-5 py-4 border-b bg-muted/20 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[15px]">Annotation Schema</h3>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      Input/output schema defining what annotators see and produce for each file.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowTaskManager(true)}>
                    <Settings2 className="h-3.5 w-3.5" />
                    Edit Schema
                  </Button>
                </div>
                {mission.configuredTasks && mission.configuredTasks.length > 0 ? (
                  <div className="divide-y">
                    {resolveAnnotationTemplates(mission).map((task, i) => {
                      const cfg = mission.configuredTasks![i];
                      const merged = { ...task.template.defaultConfig, ...(cfg?.configOverrides ?? {}) };
                      const labelCount = (merged.labels?.length ?? 0) + (merged.classes?.length ?? 0) + (merged.entityTypes?.length ?? 0) + (merged.segmentLabels?.length ?? 0);
                      return (
                        <div key={task.key} className="px-5 py-3.5 flex items-start gap-3">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 mt-0.5">
                            {i + 1}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm">{task.template.emoji}</span>
                              <p className="text-[13px] font-medium">{task.title}</p>
                              {task.required && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-600">Required</Badge>
                              )}
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">
                                {task.template.uiComponent.replace(/_/g, " ")}
                              </Badge>
                            </div>
                            <p className="text-[12px] text-muted-foreground">{task.instruction}</p>
                            {/* Schema summary */}
                            <div className="flex items-center gap-2 flex-wrap pt-0.5">
                              {labelCount > 0 && (
                                <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                                  {labelCount} {labelCount === 1 ? "option" : "options"} defined
                                </span>
                              )}
                              {merged.min !== undefined && merged.max !== undefined && (
                                <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                                  Range: {merged.min}–{merged.max}
                                </span>
                              )}
                              {merged.maxLength && (
                                <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                                  Max {merged.maxLength} chars
                                </span>
                              )}
                              {/* Show color swatches for labels/classes */}
                              {(merged.labels ?? merged.classes ?? merged.entityTypes ?? merged.segmentLabels ?? []).slice(0, 6).map((item: { id: string; color?: string; label: string }) => (
                                <span
                                  key={item.id}
                                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                                  title={item.label}
                                >
                                  <span
                                    className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                                    style={{ backgroundColor: item.color || "#6b7280" }}
                                  />
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center text-muted-foreground">
                    <p className="text-[14px] font-medium">No annotation schema configured</p>
                    <p className="text-[13px] mt-1">Click "Edit Schema" to define what annotators should label and how their output is structured.</p>
                  </div>
                )}
              </div>

              {/* ═══ Upload Review Queue ═══ */}
              <div className="border rounded-xl bg-card overflow-hidden">
                <div className="px-5 py-4 border-b bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-yellow-600" />
                    <h3 className="font-semibold text-[15px]">Upload Review</h3>
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {uploadQueue.length} upload{uploadQueue.length !== 1 ? "s" : ""} awaiting approval before annotation can begin.
                  </p>
                </div>
                {uploadQueue.length === 0 ? (
                  <div className="px-5 py-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
                    <p className="text-[13px]">No uploads pending review.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {uploadQueue.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                        <FileUp className="h-4 w-4 text-yellow-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[13px] truncate">{f.filename}</p>
                          <p className="text-[11px] text-muted-foreground">
                            by {f.contributor_name} · {new Date(f.uploaded_at).toLocaleDateString()} · {f.type} · {f.size_kb >= 1000 ? `${(f.size_kb / 1000).toFixed(1)} MB` : `${f.size_kb} KB`}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-[12px] text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                            onClick={() => { setReviewFile(f); setReviewAction("approve"); }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-[12px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => { setReviewFile(f); setReviewAction("reject"); }}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ═══ Annotation Review Queue ═══ */}
              <div className="border rounded-xl bg-card overflow-hidden">
                <div className="px-5 py-4 border-b bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-violet-600" />
                    <h3 className="font-semibold text-[15px]">Annotation Review</h3>
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {reviewQueue.length} annotated file{reviewQueue.length !== 1 ? "s" : ""} awaiting review before integration.
                  </p>
                </div>
                {reviewQueue.length === 0 ? (
                  <div className="px-5 py-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
                    <p className="text-[13px]">No annotations pending review.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {reviewQueue.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                        <Tag className="h-4 w-4 text-violet-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[13px] truncate">{f.filename}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-[11px] text-muted-foreground">
                              by {f.contributor_name}
                            </p>
                            {f.annotations && f.annotations.length > 0 && (
                              <>
                                <span className="text-muted-foreground text-[11px]">·</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {f.annotations.length} annotation{f.annotations.length !== 1 ? "s" : ""}
                                </span>
                                {f.annotations.slice(-1).map((a) => (
                                  <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                                    <Tag className="h-2.5 w-2.5" /> {a.label}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-[12px] text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                            onClick={() => { setReviewFile(f); setReviewAction("approve"); }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Integrate
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-[12px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => { setReviewFile(f); setReviewAction("reject"); }}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Send Back
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ─── Dialogs ─── */}
      <Dialog open={!!annotateFile} onOpenChange={() => { setAnnotateFile(null); setAnnotationLabel(""); setAnnotationNotes(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Label this file</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{annotateFile?.filename}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Label / Category</Label>
              <Input placeholder="e.g., Late Blight, Healthy, Rice Blast…" value={annotationLabel} onChange={(e) => setAnnotationLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Notes (optional)</Label>
              <Textarea placeholder="Additional observations…" value={annotationNotes} onChange={(e) => setAnnotationNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnotateFile(null)}>Cancel</Button>
            <Button
              disabled={!annotationLabel.trim()}
              onClick={() => {
                if (annotateFile && mission) {
                  store.addAnnotation(mission.id, annotateFile.id, annotationLabel, annotationNotes);
                }
                setAnnotateFile(null);
                setAnnotationLabel("");
                setAnnotationNotes("");
              }}
            >
              Save Label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewFile} onOpenChange={() => { setReviewFile(null); setReviewAction(null); setReviewNote(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve"
                ? reviewFile?.status === "pending_review" ? "Integrate annotation" : "Approve upload"
                : reviewFile?.status === "pending_review" ? "Send back for re-annotation" : "Reject upload"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1.5">
                <p><span className="font-mono">{reviewFile?.filename}</span> by {reviewFile?.contributor_name}</p>
                <p className="text-[12px]">
                  {reviewAction === "approve"
                    ? reviewFile?.status === "pending_review"
                      ? "This annotation will be approved and the file integrated into the final dataset."
                      : "This upload will be approved and queued for annotation."
                    : reviewFile?.status === "pending_review"
                      ? "The annotation will be rejected and the file sent back for re-annotation."
                      : "This upload will be rejected."}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Note (optional)</Label>
            <Textarea
              placeholder={reviewAction === "reject" ? "Reason for rejection…" : "Any comments…"}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewFile(null)}>Cancel</Button>
            <Button
              variant={reviewAction === "approve" ? "default" : "destructive"}
              onClick={() => {
                if (reviewFile && mission) {
                  if (reviewAction === "approve") {
                    store.approveFile(mission.id, reviewFile.id, reviewNote);
                  } else {
                    store.rejectFile(mission.id, reviewFile.id, reviewNote);
                  }
                }
                setReviewFile(null);
                setReviewAction(null);
                setReviewNote("");
              }}
            >
              {reviewAction === "approve"
                ? reviewFile?.status === "pending_review" ? "Integrate" : "Approve"
                : reviewFile?.status === "pending_review" ? "Send Back" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Task Manager Dialog (Reviewer) ─── */}
      {mission && userRole === "reviewer" && (
        <TaskManagerDialog
          open={showTaskManager}
          onOpenChange={setShowTaskManager}
          mission={mission}
          onSave={(tasks) => {
            store.updateMissionTasks(mission.id, tasks);
            setShowTaskManager(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Task Manager Dialog (Reviewer-only) ────────────────────────────
import { useMemo } from "react";
import type { Mission } from "@/lib/mock-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getTemplate } from "@/lib/annotation-tasks";
import { TaskConfigEditor } from "@/components/annotation/task-config-editor";

function TaskManagerDialog({
  open,
  onOpenChange,
  mission,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mission: Mission;
  onSave: (tasks: MissionTaskConfig[]) => void;
}) {
  // Local editable copy of tasks — preserves full config overrides
  const [taskConfigs, setTaskConfigs] = useState<MissionTaskConfig[]>(
    () => (mission.configuredTasks ?? []).map((t) => ({ ...t, configOverrides: { ...t.configOverrides } })),
  );
  const [activeTaskIdx, setActiveTaskIdx] = useState<number | null>(
    () => (mission.configuredTasks && mission.configuredTasks.length > 0 ? 0 : null),
  );

  const availableTemplates = useMemo(
    () => getTemplatesForModelType(mission.model_type),
    [mission.model_type],
  );

  const recommendedTypes = useMemo(
    () => new Set(getRecommendedTemplates(mission.model_type).map((t) => t.type)),
    [mission.model_type],
  );

  const grouped = useMemo(
    () => groupTemplatesByCategory(availableTemplates),
    [availableTemplates],
  );

  const selectedTypes = useMemo(
    () => new Set(taskConfigs.map((t) => t.type)),
    [taskConfigs],
  );

  const toggleTask = (type: AnnotationTaskType) => {
    if (selectedTypes.has(type)) {
      const idx = taskConfigs.findIndex((t) => t.type === type);
      const next = taskConfigs.filter((t) => t.type !== type);
      setTaskConfigs(next);
      // Adjust active index
      if (activeTaskIdx !== null) {
        if (activeTaskIdx === idx) setActiveTaskIdx(next.length > 0 ? Math.min(idx, next.length - 1) : null);
        else if (activeTaskIdx > idx) setActiveTaskIdx(activeTaskIdx - 1);
      }
    } else {
      const tpl = getTemplate(type);
      const newTask: MissionTaskConfig = {
        type,
        required: false,
        configOverrides: tpl ? { ...tpl.defaultConfig } : {},
      };
      const next = [...taskConfigs, newTask];
      setTaskConfigs(next);
      setActiveTaskIdx(next.length - 1); // Auto-select for configuration
    }
  };

  const updateTaskConfig = useCallback((idx: number, updated: MissionTaskConfig) => {
    setTaskConfigs((prev) => prev.map((t, i) => (i === idx ? updated : t)));
  }, []);

  const removeTask = (idx: number) => {
    const next = taskConfigs.filter((_, i) => i !== idx);
    setTaskConfigs(next);
    if (activeTaskIdx === idx) setActiveTaskIdx(next.length > 0 ? Math.min(idx, next.length - 1) : null);
    else if (activeTaskIdx !== null && activeTaskIdx > idx) setActiveTaskIdx(activeTaskIdx - 1);
  };

  const moveTask = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= taskConfigs.length) return;
    const next = [...taskConfigs];
    [next[idx], next[target]] = [next[target], next[idx]];
    setTaskConfigs(next);
    if (activeTaskIdx === idx) setActiveTaskIdx(target);
    else if (activeTaskIdx === target) setActiveTaskIdx(idx);
  };

  const handleSave = () => onSave(taskConfigs);

  const activeTask = activeTaskIdx !== null ? taskConfigs[activeTaskIdx] : null;
  const activeTemplate = activeTask ? getTemplate(activeTask.type) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-7xl max-h-[92vh] h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Annotation Schema Editor
          </DialogTitle>
          <DialogDescription>
            Define the annotation tasks, input types, and output schemas for this mission.
            Annotators will follow this configuration when labeling data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* ═══ LEFT PANEL — Task Selection & Order ═══ */}
          <div className="w-full md:w-[300px] lg:w-[360px] border-b md:border-b-0 md:border-r flex flex-col shrink-0 max-h-[35vh] md:max-h-none">
            <div className="px-4 py-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">Active Tasks</span>
                <Badge variant="secondary" className="text-[11px]">
                  {taskConfigs.length}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Click a task to configure its schema. Drag to reorder.
              </p>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1.5">
                {/* Active tasks (ordered) */}
                {taskConfigs.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-[13px] font-medium">No tasks added</p>
                    <p className="text-[11px] mt-1">Add tasks from the catalog below.</p>
                  </div>
                )}
                {taskConfigs.map((tc, idx) => {
                  const tpl = getTemplate(tc.type);
                  if (!tpl) return null;
                  const isActive = activeTaskIdx === idx;
                  return (
                    <div
                      key={`${tc.type}-${idx}`}
                      className={`group flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-all ${
                        isActive
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/30 hover:bg-muted/30"
                      }`}
                      onClick={() => setActiveTaskIdx(idx)}
                    >
                      {/* Reorder controls */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          className="text-muted-foreground/40 hover:text-foreground h-3 disabled:opacity-20"
                          disabled={idx === 0}
                          onClick={(e) => { e.stopPropagation(); moveTask(idx, -1); }}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground/40 hover:text-foreground h-3 disabled:opacity-20"
                          disabled={idx === taskConfigs.length - 1}
                          onClick={(e) => { e.stopPropagation(); moveTask(idx, 1); }}
                        >
                          ▼
                        </button>
                      </div>
                      <span className="text-sm shrink-0">{tpl.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate">
                          {tc.customTitle || tpl.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {tpl.category} · {tc.required ? "required" : "optional"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        onClick={(e) => { e.stopPropagation(); removeTask(idx); }}
                        title="Remove task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}

                {/* Separator before catalog */}
                {taskConfigs.length > 0 && (
                  <Separator className="my-3" />
                )}

                {/* Task catalog */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-muted-foreground">Add Tasks</span>
                    <button
                      type="button"
                      onClick={() => {
                        const recommended = getRecommendedTemplates(mission.model_type);
                        const newTasks: MissionTaskConfig[] = recommended.map((t) => ({
                          type: t.type,
                          required: false,
                          configOverrides: { ...t.defaultConfig },
                        }));
                        setTaskConfigs(newTasks);
                        setActiveTaskIdx(newTasks.length > 0 ? 0 : null);
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 ml-auto"
                    >
                      <Sparkles className="h-3 w-3" />
                      Use recommended
                    </button>
                  </div>

                  {(Object.entries(grouped) as [string, typeof availableTemplates][]).map(
                    ([cat, templates]) => (
                      <div key={cat} className="space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                          {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
                        </span>
                        {templates.map((tpl) => {
                          const isAdded = selectedTypes.has(tpl.type);
                          return (
                            <button
                              key={tpl.type}
                              type="button"
                              onClick={() => { if (!isAdded) toggleTask(tpl.type); }}
                              disabled={isAdded}
                              className={`w-full text-left rounded-md px-2.5 py-1.5 text-[12px] transition-all flex items-center gap-2 ${
                                isAdded
                                  ? "opacity-40 cursor-not-allowed bg-muted/20"
                                  : "hover:bg-muted/50 cursor-pointer"
                              }`}
                            >
                              <span>{tpl.emoji}</span>
                              <span className="flex-1 truncate">{tpl.label}</span>
                              {isAdded ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                              ) : recommendedTypes.has(tpl.type) ? (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">rec</Badge>
                              ) : (
                                <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* ═══ RIGHT PANEL — Task Configuration ═══ */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {activeTask && activeTemplate ? (
              <ScrollArea className="flex-1">
                <div className="p-4 sm:p-6 lg:p-8">
                  <TaskConfigEditor
                    template={activeTemplate}
                    taskConfig={activeTask}
                    onChange={(updated) => updateTaskConfig(activeTaskIdx!, updated)}
                  />
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div className="space-y-2 text-muted-foreground">
                  <Settings2 className="h-10 w-10 mx-auto opacity-30" />
                  <p className="text-[14px] font-medium">
                    {taskConfigs.length === 0
                      ? "Add annotation tasks to get started"
                      : "Select a task to configure"}
                  </p>
                  <p className="text-[12px] max-w-sm mx-auto">
                    {taskConfigs.length === 0
                      ? "Choose from the task catalog on the left, or click 'Use recommended' for sensible defaults based on your model type."
                      : "Click on any task in the list to customize its labels, output schema, and annotator instructions."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t shrink-0 flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 sm:mr-auto text-[12px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Changes apply to new annotations. Existing annotations are preserved.
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Save ({taskConfigs.length} task{taskConfigs.length !== 1 ? "s" : ""})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
