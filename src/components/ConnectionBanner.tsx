import { Wifi, WifiOff } from "lucide-react";

interface Props {
  connected: boolean | null;
}

export function ConnectionBanner({ connected }: Props) {
  if (connected === null) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border text-xs text-muted-foreground">
        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
        Connecting to monitoring agent…
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border-b border-border text-xs text-success">
        <Wifi className="h-3 w-3" />
        Live — Connected to monitoring agent
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border-b border-border text-xs text-warning">
      <WifiOff className="h-3 w-3" />
      Agent offline — Showing simulated data. Start the agent with{" "}
      <code className="font-mono bg-muted/50 px-1 rounded">sudo python3 agent/monitor.py</code>
    </div>
  );
}
