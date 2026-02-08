import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Users,
  FileUp,
  ArrowUpRight,
  Sparkles,
  TrendingUp,
  Clock,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { AnimatedCard } from "@/components/ui/animated-card";
import { MODEL_TYPES, MODEL_TYPE_LIST } from "@/lib/mock-data";
import type { ModelType } from "@/lib/mock-data";
import { useStore } from "@/lib/store";

const CATEGORY_EMOJI: Record<string, string> = {
  Agriculture: "🌾",
  Environment: "🌍",
  Languages: "🗣️",
  "Public Health": "💧",
  Conservation: "🐾",
};

type SortKey = "trending" | "recent" | "most-data";

// Stagger animation variants
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function MissionsPage() {
  const { missions, getModels } = useStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [modelTypeFilter, setModelTypeFilter] = useState<ModelType | null>(null);
  const [sort, setSort] = useState<SortKey>("trending");

  const categories = [...new Set(missions.map((m) => m.category))];

  const filtered = missions.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      m.title.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.reason.toLowerCase().includes(q) ||
      m.accepted_types.some((t) => t.includes(q)) ||
      MODEL_TYPES[m.model_type].label.toLowerCase().includes(q);
    const matchCategory = !filter || m.category === filter;
    const matchModelType = !modelTypeFilter || m.model_type === modelTypeFilter;
    return matchSearch && matchCategory && matchModelType;
  }).sort((a, b) => {
    if (sort === "recent")
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === "most-data")
      return b.current_contributions - a.current_contributions;
    // trending — active first, then by percentage filled
    const aPct = a.current_contributions / a.target_contributions;
    const bPct = b.current_contributions / b.target_contributions;
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return bPct - aPct;
  });

  return (
    <motion.div
      className="max-w-4xl mx-auto space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ─── Header ─── */}
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-body text-2xl font-bold tracking-tight">Missions</h1>
          <p className="text-muted-foreground text-[15px]">
            Community data collection campaigns. Pick one and start contributing.
          </p>
        </div>
        <Link to="/app/missions/new">
          <Button className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            New Mission
          </Button>
        </Link>
      </motion.div>

      {/* ─── Search + Filters bar ─── */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search missions, categories or file types…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <div className="flex gap-1.5">
          {(
            [
              { key: "trending", label: "Trending", icon: TrendingUp },
              { key: "recent", label: "Recent", icon: Clock },
              { key: "most-data", label: "Most data", icon: FileUp },
            ] as const
          ).map((s) => (
            <Button
              key={s.key}
              variant={sort === s.key ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setSort(s.key)}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* ─── Category pills ─── */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-full border px-3 py-1 text-[13px] font-medium transition-all ${
            !filter
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:border-foreground/30"
          }`}
        >
          All missions
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(filter === cat ? null : cat)}
            className={`rounded-full border px-3 py-1 text-[13px] font-medium transition-all ${
              filter === cat
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            {CATEGORY_EMOJI[cat] ?? "📁"} {cat}
          </button>
        ))}
      </motion.div>

      {/* ─── Model Type pills ─── */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
        <button
          onClick={() => setModelTypeFilter(null)}
          className={`rounded-full border px-3 py-1 text-[13px] font-medium transition-all ${
            !modelTypeFilter
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:border-foreground/30"
          }`}
        >
          All types
        </button>
        {MODEL_TYPE_LIST.map((mt) => (
          <button
            key={mt.key}
            onClick={() => setModelTypeFilter(modelTypeFilter === mt.key ? null : mt.key)}
            className={`rounded-full border px-3 py-1 text-[13px] font-medium transition-all ${
              modelTypeFilter === mt.key
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            {mt.emoji} {mt.label}
          </button>
        ))}
      </motion.div>

      <Separator />

      {/* ─── Mission List (card-based) ─── */}
      <motion.div
        className="space-y-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {filtered.map((mission) => {
          const pct = Math.round(
            (mission.current_contributions / mission.target_contributions) * 100,
          );
          const contribCount = mission.contributors.filter(
            (c) => c.role === "contributor",
          ).length;
          const totalFiles = mission.datasets.reduce(
            (s, d) => s + d.file_count,
            0,
          );
          const modelCount = getModels(mission.id).length;
          const mt = MODEL_TYPES[mission.model_type];

          return (
            <motion.div key={mission.id} variants={itemVariants}>
              <Link
                to={`/app/missions/${mission.id}`}
                className="block"
              >
                <AnimatedCard className="p-4">
                  <div className="flex gap-4">
                    {/* Left — Emoji avatar */}
                    <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
                      {CATEGORY_EMOJI[mission.category] ?? "📁"}
                    </div>

                    {/* Center — Info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[15px] group-hover:text-primary transition-colors truncate">
                          {mission.title}
                        </span>
                        {mission.status === "completed" && (
                          <Badge
                            variant="outline"
                            className="text-green-600 border-green-300 text-[11px] px-1.5 py-0"
                          >
                            Complete
                          </Badge>
                        )}
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${mt.bgColor}`}>
                          <span>{mt.emoji}</span>
                          <span className={mt.color}>{mt.label}</span>
                        </span>
                        {modelCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-500 text-[11px] font-medium">
                            <Sparkles className="h-3 w-3" />
                            {modelCount} model{modelCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      <p className="text-[13px] text-muted-foreground line-clamp-1 leading-snug">
                        {mission.reason}
                      </p>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {contribCount + mission.contributors.length}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileUp className="h-3 w-3" />
                          {totalFiles.toLocaleString()} files
                        </span>
                        <span className="text-muted-foreground/50">·</span>
                        <div className="flex items-center gap-1.5">
                          {mission.accepted_types.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="rounded bg-muted px-1.5 py-px font-mono text-[11px]"
                            >
                              {t}
                            </span>
                          ))}
                          {mission.accepted_types.length > 3 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{mission.accepted_types.length - 3}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Animated progress bar */}
                      <div className="flex items-center gap-2 max-w-sm">
                        <AnimatedProgress value={pct} className="h-1.5 flex-1" />
                        <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Right — CTA */}
                    <div className="hidden sm:flex items-center">
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </AnimatedCard>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No missions found</p>
          <p className="text-sm mt-1">Try a different search or category.</p>
        </div>
      )}

      {/* ─── Footer note ─── */}
      <div className="text-center py-6">
        <p className="text-xs text-muted-foreground">
          {missions.length} missions · {missions.reduce((s, m) => s + m.contributors.length, 0)} contributors ·{" "}
          {missions.reduce((s, m) => s + m.datasets.reduce((ss, d) => ss + d.file_count, 0), 0).toLocaleString()} files collected
        </p>
      </div>
    </motion.div>
  );
}
