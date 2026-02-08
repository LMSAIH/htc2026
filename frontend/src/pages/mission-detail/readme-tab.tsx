import { Info, FileText, Zap, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { getRoleLabel, type Mission } from "@/lib/mock-data";

interface ReadmeTabProps {
  mission: Mission;
}

export function ReadmeTab({ mission }: ReadmeTabProps) {
  return (
    <div className="space-y-5">
      {/* Mission card — README style */}
      <div className="prose prose-sm dark:prose-invert max-w-none border rounded-xl p-6 bg-card">
        <h2 className="flex items-center gap-2 text-lg font-semibold mt-0!">
          <Info className="h-4.5 w-4.5 text-primary" />
          Why this mission matters
        </h2>
        <p className="text-[14px] leading-relaxed text-muted-foreground">{mission.reason}</p>

        <Separator className="my-5" />

        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-4.5 w-4.5 text-primary" />
          About
        </h2>
        <p className="text-[14px] leading-relaxed">{mission.description}</p>

        <Separator className="my-5" />

        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Zap className="h-4.5 w-4.5 text-primary" />
          How to contribute
        </h2>
        <div className="text-[14px] whitespace-pre-line leading-relaxed">
          {mission.how_to_contribute}
        </div>
      </div>

      {/* Team sidebar-style section */}
      <div className="border rounded-xl p-5 bg-card space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Team ({mission.contributors.length})
        </h3>
        <div className="flex flex-wrap gap-3">
          {mission.contributors.map((c) => (
            <div
              key={c.user_id}
              className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
            >
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary">
                {c.user_name.split(" ").map((w) => w[0]).join("")}
              </div>
              <div>
                <p className="text-[13px] font-medium leading-tight">{c.user_name}</p>
                <p className="text-[11px] text-muted-foreground">{getRoleLabel(c.role)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
