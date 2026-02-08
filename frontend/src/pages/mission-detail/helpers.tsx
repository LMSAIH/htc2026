import type { DataFile } from "@/lib/mock-data";

export function statusBadge(s: DataFile["status"]) {
  const map = {
    approved: { label: "Integrated", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    pending: { label: "Upload pending", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
    needs_annotation: { label: "Needs annotation", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    pending_review: { label: "Awaiting review", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  } as const;
  const { label, cls } = map[s];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

export function formatSize(kb: number) {
  return kb >= 1000 ? `${(kb / 1000).toFixed(1)} MB` : `${kb} KB`;
}

export function formatSizeMb(mb: number) {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`;
}

export const CATEGORY_EMOJI: Record<string, string> = {
  Agriculture: "🌾",
  Environment: "🌍",
  Languages: "🗣️",
  "Public Health": "💧",
  Conservation: "🐾",
};
