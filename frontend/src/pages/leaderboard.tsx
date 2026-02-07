import {
  Trophy,
  Medal,
  Star,
  TrendingUp,
  FileCheck,
  ArrowUp,
  Crown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LEADERBOARD,
  CURRENT_USER,
  getRankColor,
} from "@/lib/mock-data";

const TOP_3_STYLES = [
  { ring: "ring-amber-400/30", bg: "bg-amber-50 dark:bg-amber-950/40", color: "text-amber-600", icon: Crown },
  { ring: "ring-zinc-300/30", bg: "bg-zinc-50 dark:bg-zinc-900/40", color: "text-zinc-500", icon: Medal },
  { ring: "ring-orange-300/30", bg: "bg-orange-50 dark:bg-orange-950/40", color: "text-orange-500", icon: Medal },
];

export default function LeaderboardPage() {
  const top3 = LEADERBOARD.slice(0, 3);

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

      {/* Top 3 podium */}
      <div className="grid gap-3 sm:grid-cols-3">
        {top3.map((entry, i) => {
          const style = TOP_3_STYLES[i];
          const Icon = style.icon;
          const isMe = entry.user_id === CURRENT_USER.id;
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
            {LEADERBOARD.map((entry) => {
              const isMe = entry.user_id === CURRENT_USER.id;
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
    </div>
  );
}
