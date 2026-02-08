import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  FileText,
  FileUp,
  Users,
  CheckCircle2,
  Sparkles,
  Database,
  Download,
  Pencil,
  Heart,
  Box,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRoleLabel, MODEL_TYPES } from "@/lib/mock-data";
import { useStore } from "@/lib/store";

import { CATEGORY_EMOJI, formatSizeMb } from "./mission-detail/helpers";
import { ReadmeTab } from "./mission-detail/readme-tab";
import { FilesTab } from "./mission-detail/files-tab";
import { ModelsTab } from "./mission-detail/models-tab";
import { ContributeTab } from "./mission-detail/contribute-tab";
import { AnnotateTab } from "./mission-detail/annotate-tab";
import { ReviewTab } from "./mission-detail/review-tab";

// ─── Page ────────────────────────────────────────────────────────────
export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const mission = store.getMission(id ?? "");
  const models = mission ? store.getModels(mission.id) : [];
  const userRole = mission ? store.getUserRole(mission.id) : undefined;

  const [tab, setTab] = useState("readme");

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
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-4">
        <Link to="/app" className="hover:text-foreground transition-colors">
          Missions
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{mission.title}</span>
      </div>

      {/* Title block */}
      <div className="border rounded-xl overflow-hidden bg-card">
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

          {/* Stat chips */}
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

        {/* Tab bar */}
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

      {/* Tab content */}
      <div className="pt-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsContent value="readme" className="mt-0">
            <ReadmeTab mission={mission} />
          </TabsContent>

          <TabsContent value="files" className="mt-0">
            <FilesTab mission={mission} />
          </TabsContent>

          {models.length > 0 && (
            <TabsContent value="models" className="mt-0">
              <ModelsTab mission={mission} models={models} />
            </TabsContent>
          )}

          <TabsContent value="contribute" className="mt-0">
            <ContributeTab mission={mission} />
          </TabsContent>

          {(userRole === "annotator" || userRole === "reviewer") && (
            <TabsContent value="annotate" className="mt-0">
              <AnnotateTab
                mission={mission}
                userRole={userRole}
                needsAnnotation={needsAnnotation}
                allFiles={allFiles}
              />
            </TabsContent>
          )}

          {userRole === "reviewer" && (
            <TabsContent value="review" className="mt-0">
              <ReviewTab
                mission={mission}
                allFiles={allFiles}
                uploadQueue={uploadQueue}
                annotationQueue={annotationQueue}
                reviewQueue={reviewQueue}
                integratedFiles={integratedFiles}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
