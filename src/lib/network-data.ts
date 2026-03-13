export interface Target {
  id: string;
  label: string;
  host: string;
  status: "good" | "warning" | "critical";
}

export interface TimelinePoint {
  time: number;
  latency: number;
  packetLoss: number; // 0-100
}

export interface HopData {
  hop: number;
  ip: string;
  hostname: string;
  min: number;
  max: number;
  avg: number;
  current: number;
  loss: number;
}

export const TARGETS: Target[] = [
  { id: "1", label: "Google DNS", host: "8.8.8.8", status: "good" },
  { id: "2", label: "Cloudflare", host: "1.1.1.1", status: "good" },
  { id: "3", label: "AWS us-east-1", host: "52.94.76.1", status: "warning" },
  { id: "4", label: "GitHub", host: "140.82.121.4", status: "good" },
  { id: "5", label: "Internal Gateway", host: "192.168.1.1", status: "critical" },
  { id: "6", label: "CDN Edge", host: "104.16.132.229", status: "good" },
];

const HOPS_BY_TARGET: Record<string, HopData[]> = {
  "1": [
    { hop: 1, ip: "192.168.1.1", hostname: "gateway.local", min: 1, max: 4, avg: 2, current: 2, loss: 0 },
    { hop: 2, ip: "10.0.0.1", hostname: "isp-edge.net", min: 5, max: 12, avg: 8, current: 7, loss: 0 },
    { hop: 3, ip: "72.14.215.85", hostname: "ae-5.r21.snjsca04.us.bb.gin.ntt.net", min: 10, max: 22, avg: 15, current: 14, loss: 0 },
    { hop: 4, ip: "108.170.241.97", hostname: "108.170.241.97", min: 12, max: 25, avg: 18, current: 16, loss: 0 },
    { hop: 5, ip: "8.8.8.8", hostname: "dns.google", min: 14, max: 28, avg: 20, current: 18, loss: 0 },
  ],
  "2": [
    { hop: 1, ip: "192.168.1.1", hostname: "gateway.local", min: 1, max: 3, avg: 2, current: 1, loss: 0 },
    { hop: 2, ip: "10.0.0.1", hostname: "isp-edge.net", min: 4, max: 10, avg: 7, current: 6, loss: 0 },
    { hop: 3, ip: "162.158.0.1", hostname: "cf-edge.cloudflare.com", min: 8, max: 15, avg: 11, current: 10, loss: 0 },
    { hop: 4, ip: "1.1.1.1", hostname: "one.one.one.one", min: 10, max: 18, avg: 13, current: 12, loss: 0 },
  ],
  "3": [
    { hop: 1, ip: "192.168.1.1", hostname: "gateway.local", min: 1, max: 5, avg: 3, current: 3, loss: 0 },
    { hop: 2, ip: "10.0.0.1", hostname: "isp-edge.net", min: 6, max: 15, avg: 10, current: 12, loss: 0 },
    { hop: 3, ip: "154.54.30.161", hostname: "ae-1.r02.nycmny17.us.bb.gin.ntt.net", min: 20, max: 45, avg: 32, current: 38, loss: 2 },
    { hop: 4, ip: "205.251.245.8", hostname: "aws-peer.ntt.net", min: 35, max: 80, avg: 55, current: 72, loss: 5 },
    { hop: 5, ip: "52.93.127.172", hostname: "52.93.127.172", min: 40, max: 95, avg: 65, current: 88, loss: 3 },
    { hop: 6, ip: "52.94.76.1", hostname: "ec2.us-east-1.amazonaws.com", min: 45, max: 110, avg: 70, current: 95, loss: 4 },
  ],
  "4": [
    { hop: 1, ip: "192.168.1.1", hostname: "gateway.local", min: 1, max: 3, avg: 2, current: 2, loss: 0 },
    { hop: 2, ip: "10.0.0.1", hostname: "isp-edge.net", min: 5, max: 11, avg: 8, current: 7, loss: 0 },
    { hop: 3, ip: "192.30.255.113", hostname: "github-peer.ntt.net", min: 15, max: 30, avg: 22, current: 20, loss: 0 },
    { hop: 4, ip: "140.82.121.4", hostname: "lb-140-82-121-4-iad.github.com", min: 18, max: 35, avg: 25, current: 23, loss: 0 },
  ],
  "5": [
    { hop: 1, ip: "192.168.1.1", hostname: "gateway.local", min: 1, max: 150, avg: 25, current: 120, loss: 15 },
  ],
  "6": [
    { hop: 1, ip: "192.168.1.1", hostname: "gateway.local", min: 1, max: 3, avg: 2, current: 2, loss: 0 },
    { hop: 2, ip: "10.0.0.1", hostname: "isp-edge.net", min: 4, max: 9, avg: 6, current: 5, loss: 0 },
    { hop: 3, ip: "104.16.132.229", hostname: "cdn-edge.cloudflare.com", min: 6, max: 14, avg: 9, current: 8, loss: 0 },
  ],
};

export function getHopsForTarget(targetId: string): HopData[] {
  return HOPS_BY_TARGET[targetId] || HOPS_BY_TARGET["1"];
}

export function generateTimelinePoint(targetId: string, time: number): TimelinePoint {
  const target = TARGETS.find(t => t.id === targetId);
  let baseLatency = 20;
  let lossChance = 0;

  if (target?.status === "warning") { baseLatency = 70; lossChance = 0.08; }
  if (target?.status === "critical") { baseLatency = 40; lossChance = 0.2; }

  const jitter = (Math.random() - 0.5) * baseLatency * 0.6;
  const spike = Math.random() < 0.05 ? baseLatency * (1 + Math.random() * 2) : 0;
  const latency = Math.max(1, baseLatency + jitter + spike);
  const packetLoss = Math.random() < lossChance ? Math.round(Math.random() * 100) : 0;

  return { time, latency: Math.round(latency * 10) / 10, packetLoss };
}

export function generateInitialTimeline(targetId: string, count: number = 60): TimelinePoint[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) =>
    generateTimelinePoint(targetId, now - (count - i) * 1000)
  );
}
