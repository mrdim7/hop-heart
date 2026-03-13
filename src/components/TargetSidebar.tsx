import { Target } from "@/lib/network-data";
import { Activity, Circle } from "lucide-react";

interface Props {
  targets: Target[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const statusColor: Record<Target["status"], string> = {
  good: "text-success",
  warning: "text-warning",
  critical: "text-critical",
};

export function TargetSidebar({ targets, selectedId, onSelect }: Props) {
  return (
    <div className="w-56 shrink-0 border-r border-border bg-background flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <Activity className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Targets</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {targets.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`w-full text-left px-3 py-2 border-b border-border transition-colors ${
              selectedId === t.id ? "bg-card" : "hover:bg-card/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Circle className={`h-2 w-2 fill-current ${statusColor[t.status]}`} />
              <span className="text-xs font-medium text-foreground truncate">{t.label}</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground ml-4">{t.host}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
