import { useState, useCallback } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Mission } from "@/lib/mock-data";
import { useStore } from "@/lib/store";

interface ContributeTabProps {
  mission: Mission;
}

export function ContributeTab({ mission }: ContributeTabProps) {
  const store = useStore();
  const [dragOver, setDragOver] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        mission.accepted_types.some((ext) => f.name.toLowerCase().endsWith(ext)),
      );
      setUploadFiles((prev) => [...prev, ...files]);
    },
    [mission],
  );

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    const targetDataset = mission.datasets[0];
    if (!targetDataset) return;
    await store.uploadFiles(mission.id, targetDataset.id, uploadFiles);
    setUploading(false);
    setUploadDone(true);
    setUploadFiles([]);
    setTimeout(() => setUploadDone(false), 4000);
  };

  return (
    <div className="space-y-5">
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
    </div>
  );
}
