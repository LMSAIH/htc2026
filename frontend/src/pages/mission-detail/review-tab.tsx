import { useState } from "react";
import {
  Upload,
  FileUp,
  CheckCircle2,
  XCircle,
  Tag,
  Pencil,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  resolveAnnotationTemplates,
  type DataFile,
  type Mission,
} from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { TaskManagerDialog } from "./task-manager-dialog";

interface ReviewTabProps {
  mission: Mission;
  allFiles: DataFile[];
  uploadQueue: DataFile[];
  annotationQueue: DataFile[];
  reviewQueue: DataFile[];
  integratedFiles: DataFile[];
}

export function ReviewTab({
  mission,
  allFiles,
  uploadQueue,
  annotationQueue,
  reviewQueue,
  integratedFiles,
}: ReviewTabProps) {
  const store = useStore();
  const [reviewFile, setReviewFile] = useState<DataFile | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [showTaskManager, setShowTaskManager] = useState(false);

  return (
    <>
      <div className="space-y-4">
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
      </div>

      {/* Review Dialog */}
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
                if (reviewFile) {
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

      {/* Task Manager Dialog */}
      <TaskManagerDialog
        open={showTaskManager}
        onOpenChange={setShowTaskManager}
        mission={mission}
        onSave={(tasks) => {
          store.updateMissionTasks(mission.id, tasks);
          setShowTaskManager(false);
        }}
      />
    </>
  );
}
