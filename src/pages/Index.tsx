import { useState, useEffect, useRef } from "react";
import { TargetSidebar } from "@/components/TargetSidebar";
import { LatencyTimeline } from "@/components/LatencyTimeline";
import { TracerouteTable } from "@/components/TracerouteTable";
import { StatusBar } from "@/components/StatusBar";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import {
  TARGETS as DEFAULT_TARGETS,
  generateInitialTimeline,
  generateTimelinePoint,
  getHopsForTarget,
  TimelinePoint,
  HopData,
  Target,
} from "@/lib/network-data";
import {
  checkAgentHealth,
  fetchTargets,
  fetchTimeline,
  fetchHops,
  addTarget as apiAddTarget,
  deleteTarget as apiDeleteTarget,
} from "@/lib/agent-api";
import { toast } from "sonner";

const MAX_POINTS = 300;
const POLL_INTERVAL = 1000;

let localNextId = 100;

const Index = () => {
  const [selectedId, setSelectedId] = useState("1");
  const [targets, setTargets] = useState<Target[]>(DEFAULT_TARGETS);
  const [timelines, setTimelines] = useState<Record<string, TimelinePoint[]>>({});
  const [hops, setHops] = useState<HopData[]>([]);
  const [agentConnected, setAgentConnected] = useState<boolean | null>(null);
  const intervalRef = useRef<number>();

  useEffect(() => {
    checkAgentHealth().then(ok => {
      setAgentConnected(ok);
      if (ok) fetchTargets().then(setTargets);
    });
  }, []);

  useEffect(() => {
    if (agentConnected === null) return;
    if (agentConnected) {
      fetchTimeline(selectedId).then(data => {
        setTimelines(prev => ({ ...prev, [selectedId]: data }));
      });
      fetchHops(selectedId).then(setHops);
    } else {
      if (!timelines[selectedId]) {
        setTimelines(prev => ({ ...prev, [selectedId]: generateInitialTimeline(selectedId) }));
      }
      setHops(getHopsForTarget(selectedId));
    }
  }, [selectedId, agentConnected]);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      if (agentConnected) {
        fetchTimeline(selectedId).then(data => {
          setTimelines(prev => ({ ...prev, [selectedId]: data }));
        });
        fetchHops(selectedId).then(setHops);
        fetchTargets().then(setTargets);
      } else {
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

  const handleAddTarget = async (host: string, label: string) => {
    if (agentConnected) {
      const result = await apiAddTarget(host, label);
      if (result) {
        setTargets(prev => [...prev, { ...result, status: result.status || "good" }]);
        setSelectedId(result.id);
        toast.success(`Added target: ${label}`);
      } else {
        toast.error("Failed to add target");
      }
    } else {
      // Local-only simulated target
      localNextId++;
      const id = String(localNextId);
      const newTarget: Target = { id, label, host, status: "good" };
      setTargets(prev => [...prev, newTarget]);
      setTimelines(prev => ({ ...prev, [id]: generateInitialTimeline(id) }));
      setSelectedId(id);
      toast.success(`Added target: ${label} (simulated)`);
    }
  };

  const handleDeleteTarget = async (id: string) => {
    if (targets.length <= 1) {
      toast.error("Cannot remove the last target");
      return;
    }
    if (agentConnected) {
      const ok = await apiDeleteTarget(id);
      if (!ok) { toast.error("Failed to remove target"); return; }
    }
    setTargets(prev => prev.filter(t => t.id !== id));
    setTimelines(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (selectedId === id) {
      const remaining = targets.filter(t => t.id !== id);
      setSelectedId(remaining[0]?.id || "1");
    }
    toast.success("Target removed");
  };

  const data = timelines[selectedId] || [];
  const target = targets.find(t => t.id === selectedId) || targets[0];

  return (
    <div className="flex h-screen overflow-hidden flex-col">
      <ConnectionBanner connected={agentConnected} />
      <div className="flex flex-1 min-h-0">
        <TargetSidebar
          targets={targets}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={handleAddTarget}
          onDelete={handleDeleteTarget}
        />
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
