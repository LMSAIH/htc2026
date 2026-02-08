import {
  Trophy,
  Medal,
  Star,
  TrendingUp,
  FileCheck,
  ArrowUp,
  Crown,
  Users,
  FileUp,
  Sparkles,
  Database,
  Activity,
  BarChart3,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AnimatedCard } from "@/components/ui/animated-card";
import { NumberTicker } from "@/components/magicui/number-ticker";
import {
  getRankColor,
  MODEL_TYPES,
  MODEL_TYPE_LIST,
} from "@/lib/mock-data";
import { useStore } from "@/lib/store";

const TOP_3_STYLES = [
  { ring: "ring-amber-400/30", bg: "bg-amber-50 dark:bg-amber-950/40", color: "text-amber-600", icon: Crown },
  { ring: "ring-zinc-300/30", bg: "bg-zinc-50 dark:bg-zinc-900/40", color: "text-zinc-500", icon: Medal },
  { ring: "ring-orange-300/30", bg: "bg-orange-50 dark:bg-orange-950/40", color: "text-orange-500", icon: Medal },
];

export default function LeaderboardPage() {
  const { leaderboard, missions, user, getModels } = useStore();

  const top3 = leaderboard.slice(0, 3);

  const chartData = missions.map((m) => ({
    name: m.title.split(" ").slice(0, 2).join(" "),
    contributions: m.current_contributions,
    target: m.target_contributions,
  }));

  const totalContributions = missions.reduce((s, m) => s + m.current_contributions, 0);
  const totalContributors = missions.reduce((s, m) => s + m.contributors.length, 0);
  const totalFilesCount = missions.reduce((s, m) => s + m.datasets.reduce((ss, d) => ss + d.file_count, 0), 0);
  const totalModels = missions.reduce((s, m) => s + getModels(m.id).length, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h1 className="text-xl font-bold tracking-tight">Leaderboard</h1>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Top contributors ranked by approved files, quality annotations, and confirmed reviews.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rankings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rankings" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            Rankings
          </TabsTrigger>
          <TabsTrigger value="statistics" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Statistics
          </TabsTrigger>
        </TabsList>

        {/* ═══ Rankings Tab ═══ */}
        <TabsContent value="rankings" className="space-y-6">

      {/* Top 3 podium */}
      <div className="grid gap-3 sm:grid-cols-3">
        {top3.map((entry, i) => {
          const style = TOP_3_STYLES[i];
          const Icon = style.icon;
          const isMe = entry.user_id === user?.id;
          return (
            <div
              key={entry.user_id}
              className={`relative border rounded-xl ${style.bg} ring-2 ${style.ring} overflow-hidden p-5 text-center`}
            >
              <div className={`text-lg mb-2 ${style.color}`}>
                <Icon className="h-6 w-6 mx-auto" />
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary mx-auto">
                {entry.user_name.split(" ").map((w) => w[0]).join("")}
              </div>
              <p className="mt-2 text-[14px] font-semibold">
                {entry.user_name}
                {isMe && <span className="ml-1 text-primary text-[11px]">(you)</span>}
              </p>
              <p className="text-[22px] font-bold mt-1 tabular-nums">{entry.score.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">points</p>
              <div className="flex items-center justify-center gap-1 mt-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${getRankColor(entry.badge)}`}>
                  {entry.badge}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scoring explainer */}
      <div className="border rounded-xl bg-card p-5">
        <h3 className="text-[13px] font-semibold mb-2.5 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-muted-foreground" /> How scoring works
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Approved file", pts: "+10 pts", icon: FileCheck },
            { label: "Quality annotation", pts: "+5 pts", icon: TrendingUp },
            { label: "Confirmed review", pts: "+3 pts", icon: ArrowUp },
          ].map(({ label, pts, icon: I }) => (
            <div key={label} className="space-y-1">
              <I className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-[13px] font-medium">{pts}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Full table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-muted/20">
          <h3 className="font-semibold text-[14px]">Full Rankings</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="text-[12px] text-muted-foreground">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Contributor</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Files</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Annotations</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Reviews</TableHead>
              <TableHead className="text-center">Badge</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((entry) => {
              const isMe = entry.user_id === user?.id;
              return (
                <TableRow
                  key={entry.user_id}
                  className={`text-[13px] ${isMe ? "bg-primary/5" : ""}`}
                >
                  <TableCell className="text-center font-medium tabular-nums">
                    <span className="text-muted-foreground">{entry.rank}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold shrink-0">
                        {entry.user_name.split(" ").map((w) => w[0]).join("")}
                      </div>
                      <span className="font-medium">
                        {entry.user_name}
                        {isMe && <span className="ml-1 text-primary text-[11px] font-normal">(you)</span>}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{entry.score.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums hidden sm:table-cell">{entry.approved_contributions}</TableCell>
                  <TableCell className="text-right tabular-nums hidden sm:table-cell">{entry.annotations}</TableCell>
                  <TableCell className="text-right tabular-nums hidden sm:table-cell">{entry.reviews}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${getRankColor(entry.badge)}`}>
                      {entry.badge}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

        </TabsContent>

        {/* ═══ Statistics Tab ═══ */}
        <TabsContent value="statistics" className="space-y-6">

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Contributions", value: totalContributions, icon: FileUp, color: "text-blue-600" },
              { label: "Contributors", value: totalContributors, icon: Users, color: "text-emerald-600" },
              { label: "Files Collected", value: totalFilesCount, icon: Database, color: "text-violet-600" },
              { label: "Trained Models", value: totalModels, icon: Sparkles, color: "text-amber-500" },
            ].map((stat) => (
              <AnimatedCard key={stat.label} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground font-medium">
                    {stat.label}
                  </span>
                </div>
                <p className="text-2xl font-bold tabular-nums">
                  <NumberTicker value={stat.value} />
                </p>
              </AnimatedCard>
            ))}
          </div>

          {/* Model Type Distribution */}
          <AnimatedCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Model Type Distribution</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MODEL_TYPE_LIST.map((mt) => {
                const count = missions.filter((m) => m.model_type === mt.key).length;
                return (
                  <div
                    key={mt.key}
                    className="flex items-center gap-2.5 border rounded-lg px-3 py-2.5"
                  >
                    <span className="text-lg">{mt.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate">{mt.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {count} {count === 1 ? "mission" : "missions"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </AnimatedCard>

          {/* Contributions by Mission Chart */}
          <AnimatedCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Contributions by Mission</span>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={8}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      fontSize: 12,
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar
                    dataKey="contributions"
                    fill="var(--primary)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AnimatedCard>

          {/* Per-mission breakdown table */}
          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-muted/20">
              <h3 className="font-semibold text-[14px]">Mission Breakdown</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="text-[12px] text-muted-foreground">
                  <TableHead>Mission</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="text-right">Contributions</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Contributors</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Files</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Models</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missions.map((m) => {
                  const pct = Math.round((m.current_contributions / m.target_contributions) * 100);
                  const files = m.datasets.reduce((s, d) => s + d.file_count, 0);
                  const models = getModels(m.id).length;
                  return (
                    <TableRow key={m.id} className="text-[13px]">
                      <TableCell className="font-medium max-w-[200px] truncate">{m.title}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                          style={{ borderColor: MODEL_TYPES[m.model_type].color + "40", color: MODEL_TYPES[m.model_type].color }}
                        >
                          {MODEL_TYPES[m.model_type].emoji} {MODEL_TYPES[m.model_type].label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{m.current_contributions.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.target_contributions.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{m.contributors.length}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{files.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{models}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{pct}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Scoring explainer (also shown here for context) */}
          <div className="border rounded-xl bg-card p-5">
            <h3 className="text-[13px] font-semibold mb-2.5 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-muted-foreground" /> How scoring works
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Approved file", pts: "+10 pts", icon: FileCheck },
                { label: "Quality annotation", pts: "+5 pts", icon: TrendingUp },
                { label: "Confirmed review", pts: "+3 pts", icon: ArrowUp },
              ].map(({ label, pts, icon: I }) => (
                <div key={label} className="space-y-1">
                  <I className="h-4 w-4 mx-auto text-muted-foreground" />
                  <p className="text-[13px] font-medium">{pts}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">
              {missions.length} missions · {totalContributors} contributors · {totalFilesCount.toLocaleString()} files collected
            </p>
          </div>

        </TabsContent>
      </Tabs>
    </div>
  );
}
