import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  CheckCircle2,
  Tag,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  resolveAnnotationTemplates,
  type DataFile,
  type Mission,
} from "@/lib/mock-data";
import { useStore } from "@/lib/store";

interface AnnotateTabProps {
  mission: Mission;
  isMissionOwner?: boolean;
  needsAnnotation: DataFile[];
  allFiles: DataFile[];
}

export function AnnotateTab({ mission, isMissionOwner, needsAnnotation, allFiles }: AnnotateTabProps) {
  const store = useStore();
  const [annotateFile, setAnnotateFile] = useState<DataFile | null>(null);
  const [annotationLabel, setAnnotationLabel] = useState("");
  const [annotationNotes, setAnnotationNotes] = useState("");

  return (
    <>
      <div className="space-y-4">
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

        {/* Task preview */}
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
          return (
            <div className="border rounded-xl bg-card p-6 text-center text-muted-foreground">
              <p className="text-[14px] font-medium">No annotation tasks configured</p>
              <p className="text-[13px] mt-1">
                {isMissionOwner
                  ? "Set up annotation tasks in the Review tab to enable the annotation workflow."
                  : "The mission owner hasn't configured annotation tasks yet."}
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
      </div>

      {/* Annotate Dialog */}
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
                if (annotateFile) {
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
    </>
  );
}
