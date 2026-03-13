import { TimelinePoint } from "@/lib/network-data";
import { useMemo } from "react";

interface Props {
  data: TimelinePoint[];
}

export function LatencyTimeline({ data }: Props) {
  const { maxLatency, points, lossBars } = useMemo(() => {
    const max = Math.max(100, ...data.map(d => d.latency)) * 1.15;
    const w = 900;
    const h = 220;
    const padL = 50;
    const padR = 10;
    const padT = 10;
    const padB = 24;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const pts = data.map((d, i) => {
      const x = padL + (i / (data.length - 1)) * plotW;
      const y = padT + plotH - (d.latency / max) * plotH;
      return { x, y, ...d };
    });

    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

    const bars = pts.filter(p => p.packetLoss > 0);

    const yTicks = [0, Math.round(max * 0.25), Math.round(max * 0.5), Math.round(max * 0.75), Math.round(max)];

    return {
      maxLatency: max,
      points: { line, pts, yTicks, w, h, padL, padR, padT, padB, plotW, plotH },
      lossBars: bars,
    };
  }, [data]);

  const { line, pts, yTicks, w, h, padL, padT, padB, plotW, plotH } = points;

  const latencyColor = (val: number) => {
    if (val < 50) return "hsl(var(--success))";
    if (val < 100) return "hsl(var(--warning))";
    return "hsl(var(--critical))";
  };

  const lastPoint = pts[pts.length - 1];

  return (
    <div className="border-b border-border bg-card px-3 py-2">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Latency Timeline</span>
        {lastPoint && (
          <span className="font-mono text-sm font-medium" style={{ color: latencyColor(lastPoint.latency) }}>
            {lastPoint.latency}ms
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 220 }}>
        {/* Grid lines */}
        {yTicks.map(tick => {
          const y = padT + plotH - (tick / maxLatency) * plotH;
          return (
            <g key={tick}>
              <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="hsl(var(--chart-grid))" strokeWidth="1" />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize="9" fontFamily="JetBrains Mono">
                {tick}ms
              </text>
            </g>
          );
        })}

        {/* Packet loss bars */}
        {lossBars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x - 1.5}
            y={padT}
            width={3}
            height={plotH}
            fill="hsl(var(--critical))"
            opacity={Math.min(1, bar.packetLoss / 100 + 0.3)}
          />
        ))}

        {/* Latency line */}
        <path d={line} fill="none" stroke="hsl(var(--success))" strokeWidth="1.5" />

        {/* Current value dot */}
        {lastPoint && (
          <circle cx={lastPoint.x} cy={lastPoint.y} r="3" fill={latencyColor(lastPoint.latency)} />
        )}

        {/* Time labels */}
        {[0, Math.floor(data.length * 0.25), Math.floor(data.length * 0.5), Math.floor(data.length * 0.75), data.length - 1].map(i => {
          if (!data[i]) return null;
          const x = padL + (i / (data.length - 1)) * plotW;
          const date = new Date(data[i].time);
          const label = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
          return (
            <text key={i} x={x} y={h - 4} textAnchor="middle" className="fill-muted-foreground" fontSize="8" fontFamily="JetBrains Mono">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
