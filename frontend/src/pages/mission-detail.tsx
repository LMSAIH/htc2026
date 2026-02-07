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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Progress } from "@/components/ui/progress";
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
  getMissionById,
  getModelsForMission,
  CURRENT_USER,
  getRoleLabel,
  type DataFile,
  type TrainedModel,
} from "@/lib/mock-data";

// ─── Helpers ─────────────────────────────────────────────────────────
function statusBadge(s: DataFile["status"]) {
  const map = {
    approved: { label: "Approved", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    pending: { label: "Pending", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
    needs_annotation: { label: "Needs label", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
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
  const mission = getMissionById(id ?? "");
  const models = mission ? getModelsForMission(mission.id) : [];

  const contributor = mission?.contributors.find(
    (c) => c.user_id === CURRENT_USER.id,
  );
  const userRole = contributor?.role;

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
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setUploadDone(true);
      setUploadFiles([]);
      setTimeout(() => setUploadDone(false), 4000);
    }, 1500);
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
  const allFiles = mission.datasets.flatMap((d) => d.sample_files);
  const pendingFiles = allFiles.filter((f) => f.status === "pending" || f.status === "needs_annotation");
  const needsAnnotation = allFiles.filter((f) => f.status === "needs_annotation");
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
                <h1 className="text-xl font-bold tracking-tight">{mission.title}</h1>
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
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <Heart className="h-3.5 w-3.5" /> Like
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
            <Progress value={pct} className="h-2 flex-1" />
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
              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-xl bg-card px-4 py-3 text-center">
                  <p className="text-lg font-bold text-green-600">{allFiles.filter((f) => f.status === "approved").length}</p>
                  <p className="text-[12px] text-muted-foreground">Approved</p>
                </div>
                <div className="border rounded-xl bg-card px-4 py-3 text-center">
                  <p className="text-lg font-bold text-yellow-600">{pendingFiles.length}</p>
                  <p className="text-[12px] text-muted-foreground">Pending</p>
                </div>
                <div className="border rounded-xl bg-card px-4 py-3 text-center">
                  <p className="text-lg font-bold text-red-600">{allFiles.filter((f) => f.status === "rejected").length}</p>
                  <p className="text-[12px] text-muted-foreground">Rejected</p>
                </div>
              </div>

              <div className="border rounded-xl bg-card overflow-hidden">
                <div className="px-5 py-4 border-b bg-muted/20">
                  <h3 className="font-semibold text-[15px]">Review Queue</h3>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {pendingFiles.length} submission{pendingFiles.length !== 1 ? "s" : ""} awaiting review
                  </p>
                </div>
                {pendingFiles.length === 0 ? (
                  <div className="px-5 py-10 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-[14px] font-medium">All caught up!</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {pendingFiles.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[13px] truncate">{f.filename}</p>
                          <p className="text-[11px] text-muted-foreground">by {f.contributor_name} · {new Date(f.uploaded_at).toLocaleDateString()}</p>
                        </div>
                        {statusBadge(f.status)}
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                            onClick={() => { setReviewFile(f); setReviewAction("approve"); }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => { setReviewFile(f); setReviewAction("reject"); }}
                          >
                            <XCircle className="h-4 w-4" />
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
            <Button disabled={!annotationLabel.trim()} onClick={() => { setAnnotateFile(null); setAnnotationLabel(""); setAnnotationNotes(""); }}>
              Save Label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewFile} onOpenChange={() => { setReviewFile(null); setReviewAction(null); setReviewNote(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewAction === "approve" ? "Approve" : "Reject"} submission</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{reviewFile?.filename}</span> by {reviewFile?.contributor_name}
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
              onClick={() => { setReviewFile(null); setReviewAction(null); setReviewNote(""); }}
            >
              {reviewAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
