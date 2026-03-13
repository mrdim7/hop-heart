import { Target, TimelinePoint } from "@/lib/network-data";

interface Props {
  target: Target;
  data: TimelinePoint[];
}

export function StatusBar({ target, data }: Props) {
  const last = data[data.length - 1];
  const avgLatency = data.length ? Math.round(data.reduce((s, d) => s + d.latency, 0) / data.length * 10) / 10 : 0;
  const maxLatency = data.length ? Math.round(Math.max(...data.map(d => d.latency)) * 10) / 10 : 0;
  const totalLoss = data.filter(d => d.packetLoss > 0).length;
  const lossPercent = data.length ? Math.round((totalLoss / data.length) * 1000) / 10 : 0;

  return (
    <div className="flex items-center gap-6 px-3 py-2 border-b border-border bg-background">
      <div>
        <span className="text-sm font-semibold text-foreground">{target.label}</span>
        <span className="ml-2 font-mono text-xs text-muted-foreground">{target.host}</span>
      </div>
      <div className="flex gap-5 ml-auto text-xs">
        <div>
          <span className="text-muted-foreground">Current </span>
          <span className="font-mono font-medium text-foreground">{last?.latency ?? 0}ms</span>
        </div>
        <div>
          <span className="text-muted-foreground">Avg </span>
          <span className="font-mono font-medium text-foreground">{avgLatency}ms</span>
        </div>
        <div>
          <span className="text-muted-foreground">Max </span>
          <span className="font-mono font-medium text-foreground">{maxLatency}ms</span>
        </div>
        <div>
          <span className="text-muted-foreground">Loss </span>
          <span className={`font-mono font-medium ${lossPercent > 0 ? "text-critical" : "text-success"}`}>{lossPercent}%</span>
        </div>
      </div>
    </div>
  );
}
