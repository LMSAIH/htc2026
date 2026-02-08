import { useState } from "react";
import {
  Upload,
  Download,
  Sparkles,
  Play,
  Send,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Mission, TrainedModel } from "@/lib/mock-data";

interface ModelsTabProps {
  mission: Mission;
  models: TrainedModel[];
}

export function ModelsTab({ mission, models }: ModelsTabProps) {
  const [selectedModel, setSelectedModel] = useState<TrainedModel | null>(null);
  const [modelInput, setModelInput] = useState("");
  const [modelResult, setModelResult] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);

  const handleModelRun = (model: TrainedModel) => {
    setModelLoading(true);
    setModelResult(null);
    setTimeout(() => {
      setModelResult(model.output_example);
      setModelLoading(false);
    }, 1800);
  };

  return (
    <div className="space-y-4">
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
    </div>
  );
}
