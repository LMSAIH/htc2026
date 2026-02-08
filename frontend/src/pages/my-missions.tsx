import { Link } from "react-router-dom";
import {
  Upload,
  Pencil,
  Eye,
  ArrowUpRight,
  FolderOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  getRoleLabel,
  type Role,
} from "@/lib/mock-data";
import { useStore } from "@/lib/store";

const CATEGORY_EMOJI: Record<string, string> = {
  Agriculture: "🌾",
  Environment: "🌍",
  Languages: "🗣️",
  "Public Health": "💧",
  Conservation: "🐾",
};

const ROLE_ICON: Record<Role, React.ElementType> = {
  contributor: Upload,
  annotator: Pencil,
  reviewer: Eye,
};

const ROLE_COLOR: Record<Role, string> = {
  contributor: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  annotator: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  reviewer: "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300",
};

export default function MyMissionsPage() {
  const { user, getUserMissions } = useStore();
  const userMissions = getUserMissions();

  const byRole = {
    contributor: userMissions.filter((m) => m.role === "contributor"),
    annotator: userMissions.filter((m) => m.role === "annotator"),
    reviewer: userMissions.filter((m) => m.role === "reviewer"),
  };

  const totalContributions = user?.approved_contributions ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile header (minimal) */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold text-primary shrink-0">
            {user?.name.split(" ").map((w) => w[0]).join("") ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight">{user?.name ?? "Guest"}</h1>
            <p className="text-[13px] text-muted-foreground">
              {totalContributions} approved contributions · Rank #{user?.rank ?? "-"}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-center">
            <div>
              <p className="text-lg font-bold">{userMissions.length}</p>
              <p className="text-[11px] text-muted-foreground">Missions</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div>
              <p className="text-lg font-bold">{Object.keys(byRole).filter((r) => byRole[r as Role].length > 0).length}</p>
              <p className="text-[11px] text-muted-foreground">Roles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList className="bg-muted/50 h-auto p-1 gap-1">
          <TabsTrigger value="all" className="text-[13px] px-4 py-1.5">
            All ({userMissions.length})
          </TabsTrigger>
          <TabsTrigger value="contributor" className="text-[13px] px-4 py-1.5 gap-1.5">
            <Upload className="h-3 w-3" /> Contributor ({byRole.contributor.length})
          </TabsTrigger>
          <TabsTrigger value="annotator" className="text-[13px] px-4 py-1.5 gap-1.5">
            <Pencil className="h-3 w-3" /> Annotator ({byRole.annotator.length})
          </TabsTrigger>
          <TabsTrigger value="reviewer" className="text-[13px] px-4 py-1.5 gap-1.5">
            <Eye className="h-3 w-3" /> Reviewer ({byRole.reviewer.length})
          </TabsTrigger>
        </TabsList>

        {(["all", "contributor", "annotator", "reviewer"] as const).map((tabKey) => {
          const missions = tabKey === "all" ? userMissions : byRole[tabKey];
          return (
            <TabsContent key={tabKey} value={tabKey} className="mt-4">
              {missions.length === 0 ? (
                <div className="border rounded-xl bg-card px-6 py-14 text-center text-muted-foreground">
                  <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-[14px] font-medium">No missions here yet</p>
                  <p className="text-[13px] mt-0.5">
                    Browse <Link to="/app" className="text-primary hover:underline">available missions</Link> to get started.
                  </p>
                </div>
              ) : (
                <div className="border rounded-xl bg-card overflow-hidden divide-y">
                  {missions.map(({ mission, role }) => {
                    const pct = Math.round(
                      (mission.current_contributions / mission.target_contributions) * 100,
                    );
                    const RoleIcon = ROLE_ICON[role];
                    return (
                      <Link
                        key={`${mission.id}-${role}`}
                        to={`/app/missions/${mission.id}`}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group"
                      >
                        {/* Emoji avatar */}
                        <span className="text-xl shrink-0">
                          {CATEGORY_EMOJI[mission.category] ?? "📁"}
                        </span>

                        {/* Info column */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[14px] font-semibold truncate group-hover:text-primary transition-colors">
                              {mission.title}
                            </p>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_COLOR[role]}`}>
                              <RoleIcon className="h-2.5 w-2.5" />
                              {getRoleLabel(role)}
                            </span>
                            {mission.status === "completed" && (
                              <Badge variant="outline" className="text-green-600 border-green-300 text-[11px] px-1.5 py-0">
                                Complete
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={pct} className="h-1.5 flex-1 max-w-40" />
                            <span className="text-[12px] text-muted-foreground tabular-nums shrink-0">
                              {pct}%
                            </span>
                            <span className="text-[12px] text-muted-foreground shrink-0">
                              {mission.contributors.length} members
                            </span>
                          </div>
                        </div>

                        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
