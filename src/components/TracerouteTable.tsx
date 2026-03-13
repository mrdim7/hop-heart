import { HopData } from "@/lib/network-data";

interface Props {
  hops: HopData[];
}

function latencyClass(val: number) {
  if (val < 50) return "text-success";
  if (val < 100) return "text-warning";
  return "text-critical";
}

function lossClass(val: number) {
  if (val === 0) return "text-muted-foreground";
  if (val < 5) return "text-warning";
  return "text-critical";
}

export function TracerouteTable({ hops }: Props) {
  return (
    <div className="flex-1 overflow-auto bg-card">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Route Analysis</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left px-3 py-1.5 font-medium w-10">#</th>
            <th className="text-left px-3 py-1.5 font-medium">IP Address</th>
            <th className="text-left px-3 py-1.5 font-medium">Hostname</th>
            <th className="text-right px-3 py-1.5 font-medium">Min</th>
            <th className="text-right px-3 py-1.5 font-medium">Avg</th>
            <th className="text-right px-3 py-1.5 font-medium">Max</th>
            <th className="text-right px-3 py-1.5 font-medium">Cur</th>
            <th className="text-right px-3 py-1.5 font-medium">Loss</th>
            <th className="px-3 py-1.5 font-medium w-28">Latency Bar</th>
          </tr>
        </thead>
        <tbody>
          {hops.map(hop => {
            const barMax = Math.max(150, ...hops.map(h => h.max));
            const barWidth = (hop.current / barMax) * 100;
            return (
              <tr key={hop.hop} className="border-b border-border hover:bg-background/30">
                <td className="px-3 py-1.5 font-mono text-muted-foreground">{hop.hop}</td>
                <td className="px-3 py-1.5 font-mono text-foreground">{hop.ip}</td>
                <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[200px]">{hop.hostname}</td>
                <td className={`px-3 py-1.5 font-mono text-right ${latencyClass(hop.min)}`}>{hop.min}ms</td>
                <td className={`px-3 py-1.5 font-mono text-right ${latencyClass(hop.avg)}`}>{hop.avg}ms</td>
                <td className={`px-3 py-1.5 font-mono text-right ${latencyClass(hop.max)}`}>{hop.max}ms</td>
                <td className={`px-3 py-1.5 font-mono text-right font-medium ${latencyClass(hop.current)}`}>{hop.current}ms</td>
                <td className={`px-3 py-1.5 font-mono text-right ${lossClass(hop.loss)}`}>{hop.loss}%</td>
                <td className="px-3 py-1.5">
                  <div className="h-2.5 bg-background rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: hop.current < 50 ? "hsl(var(--success))" : hop.current < 100 ? "hsl(var(--warning))" : "hsl(var(--critical))",
                      }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
