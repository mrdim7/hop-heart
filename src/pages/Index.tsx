import { useState, useEffect, useCallback, useRef } from "react";
import { TargetSidebar } from "@/components/TargetSidebar";
import { LatencyTimeline } from "@/components/LatencyTimeline";
import { TracerouteTable } from "@/components/TracerouteTable";
import { StatusBar } from "@/components/StatusBar";
import {
  TARGETS,
  generateInitialTimeline,
  generateTimelinePoint,
  getHopsForTarget,
  TimelinePoint,
  HopData,
} from "@/lib/network-data";

const MAX_POINTS = 120;

const Index = () => {
  const [selectedId, setSelectedId] = useState("1");
  const [timelines, setTimelines] = useState<Record<string, TimelinePoint[]>>({});
  const [hops, setHops] = useState<HopData[]>([]);
  const intervalRef = useRef<number>();

  // Initialize timeline for selected target
  useEffect(() => {
    if (!timelines[selectedId]) {
      setTimelines(prev => ({ ...prev, [selectedId]: generateInitialTimeline(selectedId) }));
    }
    setHops(getHopsForTarget(selectedId));
  }, [selectedId]);

  // Real-time updates
  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      const now = Date.now();
      setTimelines(prev => {
        const updated = { ...prev };
        // Update all active timelines
        for (const id of Object.keys(updated)) {
          const newPoint = generateTimelinePoint(id, now);
          updated[id] = [...updated[id].slice(-(MAX_POINTS - 1)), newPoint];
        }
        return updated;
      });

      // Simulate hop jitter for selected target
      setHops(prev =>
        prev.map(h => {
          const jitter = (Math.random() - 0.5) * h.avg * 0.3;
          const current = Math.max(1, Math.round((h.avg + jitter) * 10) / 10);
          return {
            ...h,
            current,
            min: Math.min(h.min, current),
            max: Math.max(h.max, current),
          };
        })
      );
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [selectedId]);

  const data = timelines[selectedId] || [];
  const target = TARGETS.find(t => t.id === selectedId)!;

  return (
    <div className="flex h-screen overflow-hidden">
      <TargetSidebar targets={TARGETS} selectedId={selectedId} onSelect={setSelectedId} />
      <div className="flex-1 flex flex-col min-w-0">
        <StatusBar target={target} data={data} />
        <LatencyTimeline data={data} />
        <TracerouteTable hops={hops} />
      </div>
    </div>
  );
};

export default Index;
