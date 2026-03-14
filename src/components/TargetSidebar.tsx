import { useState } from "react";
import { Target } from "@/lib/network-data";
import { Activity, Circle, Plus, Trash2, X } from "lucide-react";

interface Props {
  targets: Target[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: (host: string, label: string) => void;
  onDelete: (id: string) => void;
}

const statusColor: Record<Target["status"], string> = {
  good: "text-success",
  warning: "text-warning",
  critical: "text-critical",
};

const HOST_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$|^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]{2,}$/;

export function TargetSidebar({ targets, selectedId, onSelect, onAdd, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [host, setHost] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedHost = host.trim();
    const trimmedLabel = label.trim();

    if (!trimmedHost) {
      setError("Host is required");
      return;
    }
    if (trimmedHost.length > 253) {
      setError("Host too long");
      return;
    }
    if (!HOST_REGEX.test(trimmedHost)) {
      setError("Invalid IP or hostname");
      return;
    }
    if (trimmedLabel.length > 50) {
      setError("Label too long (max 50)");
      return;
    }

    onAdd(trimmedHost, trimmedLabel || trimmedHost);
    setHost("");
    setLabel("");
    setError("");
    setShowForm(false);
  };

  return (
    <div className="w-56 shrink-0 border-r border-border bg-background flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <Activity className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Targets</span>
        <button
          onClick={() => setShowForm(s => !s)}
          className="ml-auto p-0.5 rounded hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
          title="Add target"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="px-2 py-2 border-b border-border space-y-1.5 bg-card/50">
          <input
            type="text"
            placeholder="IP or hostname"
            value={host}
            onChange={e => { setHost(e.target.value); setError(""); }}
            maxLength={253}
            className="w-full text-xs px-2 py-1.5 rounded bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            autoFocus
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={e => setLabel(e.target.value)}
            maxLength={50}
            className="w-full text-xs px-2 py-1.5 rounded bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {error && <p className="text-[10px] text-critical">{error}</p>}
          <button
            type="submit"
            className="w-full text-xs px-2 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            Add Target
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto">
        {targets.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`group w-full text-left px-3 py-2 border-b border-border transition-colors ${
              selectedId === t.id ? "bg-card" : "hover:bg-card/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Circle className={`h-2 w-2 fill-current shrink-0 ${statusColor[t.status]}`} />
              <span className="text-xs font-medium text-foreground truncate flex-1">{t.label}</span>
              <Trash2
                className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-critical transition-all shrink-0"
                onClick={e => {
                  e.stopPropagation();
                  onDelete(t.id);
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground ml-4">{t.host}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
