import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Mission } from "@/lib/mock-data";
import { statusBadge, formatSize, formatSizeMb } from "./helpers";

interface FilesTabProps {
  mission: Mission;
}

export function FilesTab({ mission }: FilesTabProps) {
  return (
    <div className="space-y-4">
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
    </div>
  );
}
