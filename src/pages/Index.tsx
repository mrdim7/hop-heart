import { useState, useEffect, useCallback, useRef } from "react";
import { TargetSidebar } from "@/components/TargetSidebar";
import { LatencyTimeline } from "@/components/LatencyTimeline";
import { TracerouteTable } from "@/components/TracerouteTable";
import { StatusBar } from "@/components/StatusBar";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import {
  TARGETS as DEFAULT_TARGETS,
  generateTimelinePoint,
  getHopsForTarget,
  TimelinePoint,
  HopData,
  Target,
} from "@/lib/network-data";
import {
  checkAgentHealth,
  isAgentAvailable,
  fetchTargets,
  fetchTimeline,
  fetchHops,
} from "@/lib/agent-api";

const MAX_POINTS = 300;
const POLL_INTERVAL = 1000;

const Index = () => {
  const [selectedId, setSelectedId] = useState("1");
  const [targets, setTargets] = useState<Target[]>(DEFAULT_TARGETS);
  const [timelines, setTimelines] = useState<Record<string, TimelinePoint[]>>({});
  const [hops, setHops] = useState<HopData[]>([]);
  const [agentConnected, setAgentConnected] = useState<boolean | null>(null);
  const intervalRef = useRef<number>();

  // Check agent on mount
  useEffect(() => {
    checkAgentHealth().then(ok => {
      setAgentConnected(ok);
      if (ok) {
        fetchTargets().then(setTargets);
      }
    });
  }, []);

  // Load data for selected target
  useEffect(() => {
    if (agentConnected === null) return; // still checking

    if (agentConnected) {
      // Fetch real data from agent
      fetchTimeline(selectedId).then(data => {
        setTimelines(prev => ({ ...prev, [selectedId]: data }));
      });
      fetchHops(selectedId).then(setHops);
    } else {
      // Simulated fallback
      if (!timelines[selectedId]) {
        const { generateInitialTimeline } = await import("@/lib/network-data");
        setTimelines(prev => ({ ...prev, [selectedId]: generateInitialTimeline(selectedId) }));
      }
      setHops(getHopsForTarget(selectedId));
    }
  }, [selectedId, agentConnected]);

  // Polling loop
  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      if (agentConnected) {
        // Poll real data from agent
        fetchTimeline(selectedId).then(data => {
          setTimelines(prev => ({ ...prev, [selectedId]: data }));
        });
        fetchHops(selectedId).then(setHops);
        // Refresh target statuses periodically
        fetchTargets().then(setTargets);
      } else {
        // Simulated updates
        const now = Date.now();
        setTimelines(prev => {
          const updated = { ...prev };
          for (const id of Object.keys(updated)) {
            const newPoint = generateTimelinePoint(id, now);
            updated[id] = [...updated[id].slice(-(MAX_POINTS - 1)), newPoint];
          }
          return updated;
        });

        setHops(prev =>
          prev.map(h => {
            const jitter = (Math.random() - 0.5) * h.avg * 0.3;
            const current = Math.max(1, Math.round((h.avg + jitter) * 10) / 10);
            return { ...h, current, min: Math.min(h.min, current), max: Math.max(h.max, current) };
          })
        );
      }
    }, POLL_INTERVAL);

    return () => clearInterval(intervalRef.current);
  }, [selectedId, agentConnected]);

  const data = timelines[selectedId] || [];
  const target = targets.find(t => t.id === selectedId) || targets[0];

  return (
    <div className="flex h-screen overflow-hidden flex-col">
      <ConnectionBanner connected={agentConnected} />
      <div className="flex flex-1 min-h-0">
        <TargetSidebar targets={targets} selectedId={selectedId} onSelect={setSelectedId} />
        <div className="flex-1 flex flex-col min-w-0">
          <StatusBar target={target} data={data} />
          <LatencyTimeline data={data} />
          <TracerouteTable hops={hops} />
        </div>
      </div>
    </div>
  );
};

export default Index;
