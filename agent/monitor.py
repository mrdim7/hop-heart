#!/usr/bin/env python3
"""
Network Monitor Agent
Performs real ICMP ping and traceroute, exposes results via REST API.
Must run as root (or with CAP_NET_RAW) for ICMP operations.

Usage:
  sudo python3 monitor.py                    # default: 0.0.0.0:5000
  sudo python3 monitor.py --port 5050        # custom port
  sudo gunicorn -w 2 -b 0.0.0.0:5000 monitor:app   # production
"""

import subprocess
import re
import time
import threading
import json
import argparse
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── In-memory store ──────────────────────────────────────────────────────────

targets: dict = {}          # id -> {id, label, host, status}
timelines: dict = {}        # id -> [TimelinePoint, ...]
hop_cache: dict = {}        # id -> [HopData, ...]
MAX_POINTS = 300            # ~5 min at 1s interval
PING_INTERVAL = 1           # seconds between pings
TRACEROUTE_INTERVAL = 30    # seconds between traceroutes

_lock = threading.Lock()
_running = True


# ── System commands ──────────────────────────────────────────────────────────

def ping_host(host: str, count: int = 1, timeout: int = 2) -> dict:
    """Run a single ping and return latency + loss info."""
    try:
        result = subprocess.run(
            ["ping", "-c", str(count), "-W", str(timeout), host],
            capture_output=True, text=True, timeout=timeout + 2
        )
        output = result.stdout

        # Parse latency from "time=XX.X ms"
        match = re.search(r"time[=<]([\d.]+)\s*ms", output)
        latency = float(match.group(1)) if match else None

        # Parse packet loss from "XX% packet loss"
        loss_match = re.search(r"([\d.]+)%\s*packet loss", output)
        packet_loss = float(loss_match.group(1)) if loss_match else 100.0

        return {
            "latency": round(latency, 1) if latency else None,
            "packetLoss": round(packet_loss, 1),
            "reachable": latency is not None
        }
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception) as e:
        return {"latency": None, "packetLoss": 100.0, "reachable": False, "error": str(e)}


def traceroute_host(host: str, max_hops: int = 30, timeout: int = 2) -> list:
    """Run traceroute and return list of hop data."""
    hops = []
    try:
        result = subprocess.run(
            ["traceroute", "-n", "-m", str(max_hops), "-w", str(timeout), host],
            capture_output=True, text=True, timeout=max_hops * timeout + 10
        )

        for line in result.stdout.strip().split("\n")[1:]:  # skip header
            line = line.strip()
            if not line:
                continue

            # Parse hop number
            parts = line.split()
            if not parts:
                continue

            try:
                hop_num = int(parts[0])
            except ValueError:
                continue

            if parts[1] == "*":
                hops.append({
                    "hop": hop_num,
                    "ip": "*",
                    "hostname": "*",
                    "min": 0, "max": 0, "avg": 0, "current": 0,
                    "loss": 100
                })
                continue

            ip = parts[1]
            # Collect all latency values from the line
            latencies = []
            for p in parts[2:]:
                try:
                    val = float(p)
                    latencies.append(val)
                except ValueError:
                    continue

            if latencies:
                hops.append({
                    "hop": hop_num,
                    "ip": ip,
                    "hostname": resolve_hostname(ip),
                    "min": round(min(latencies), 1),
                    "max": round(max(latencies), 1),
                    "avg": round(sum(latencies) / len(latencies), 1),
                    "current": round(latencies[-1], 1),
                    "loss": 0
                })
            else:
                hops.append({
                    "hop": hop_num,
                    "ip": ip,
                    "hostname": resolve_hostname(ip),
                    "min": 0, "max": 0, "avg": 0, "current": 0,
                    "loss": 100
                })

    except (subprocess.TimeoutExpired, FileNotFoundError, Exception) as e:
        hops.append({"hop": 1, "ip": "error", "hostname": str(e),
                      "min": 0, "max": 0, "avg": 0, "current": 0, "loss": 100})

    return hops


def resolve_hostname(ip: str) -> str:
    """Reverse DNS lookup."""
    try:
        result = subprocess.run(
            ["dig", "+short", "-x", ip],
            capture_output=True, text=True, timeout=3
        )
        hostname = result.stdout.strip().rstrip(".")
        return hostname if hostname else ip
    except Exception:
        return ip


# ── Background workers ──────────────────────────────────────────────────────

def ping_worker():
    """Continuously ping all targets."""
    while _running:
        with _lock:
            target_list = list(targets.values())

        for t in target_list:
            result = ping_host(t["host"])
            now = int(time.time() * 1000)

            with _lock:
                tid = t["id"]
                if tid not in timelines:
                    timelines[tid] = []

                point = {
                    "time": now,
                    "latency": result["latency"] if result["latency"] is not None else 0,
                    "packetLoss": result["packetLoss"]
                }
                timelines[tid].append(point)

                # Trim old points
                if len(timelines[tid]) > MAX_POINTS:
                    timelines[tid] = timelines[tid][-MAX_POINTS:]

                # Update target status based on recent data
                recent = timelines[tid][-10:]
                avg_loss = sum(p["packetLoss"] for p in recent) / len(recent)
                avg_lat = sum(p["latency"] for p in recent) / len(recent)

                if avg_loss > 20 or not result["reachable"]:
                    targets[tid]["status"] = "critical"
                elif avg_loss > 5 or avg_lat > 100:
                    targets[tid]["status"] = "warning"
                else:
                    targets[tid]["status"] = "good"

        time.sleep(PING_INTERVAL)


def traceroute_worker():
    """Periodically run traceroute for all targets."""
    while _running:
        with _lock:
            target_list = list(targets.values())

        for t in target_list:
            hops = traceroute_host(t["host"])
            with _lock:
                hop_cache[t["id"]] = hops

        time.sleep(TRACEROUTE_INTERVAL)


# ── Default targets ──────────────────────────────────────────────────────────

DEFAULT_TARGETS = [
    {"id": "1", "label": "Google DNS", "host": "8.8.8.8"},
    {"id": "2", "label": "Cloudflare", "host": "1.1.1.1"},
    {"id": "3", "label": "AWS us-east-1", "host": "52.94.76.1"},
    {"id": "4", "label": "GitHub", "host": "140.82.121.4"},
    {"id": "5", "label": "Gateway", "host": "192.168.1.1"},
]

_next_id = 100

def init_targets():
    global _next_id
    for t in DEFAULT_TARGETS:
        targets[t["id"]] = {**t, "status": "good"}


# ── API Routes ───────────────────────────────────────────────────────────────

@app.route("/api/targets", methods=["GET"])
def get_targets():
    with _lock:
        return jsonify(list(targets.values()))


@app.route("/api/targets", methods=["POST"])
def add_target():
    global _next_id
    data = request.json
    if not data or "host" not in data:
        return jsonify({"error": "host is required"}), 400

    with _lock:
        _next_id += 1
        tid = str(_next_id)
        targets[tid] = {
            "id": tid,
            "label": data.get("label", data["host"]),
            "host": data["host"],
            "status": "good"
        }
        timelines[tid] = []

    return jsonify(targets[tid]), 201


@app.route("/api/targets/<target_id>", methods=["DELETE"])
def delete_target(target_id):
    with _lock:
        if target_id in targets:
            del targets[target_id]
            timelines.pop(target_id, None)
            hop_cache.pop(target_id, None)
            return jsonify({"ok": True})
    return jsonify({"error": "not found"}), 404


@app.route("/api/timeline/<target_id>", methods=["GET"])
def get_timeline(target_id):
    with _lock:
        data = timelines.get(target_id, [])
        return jsonify(data)


@app.route("/api/hops/<target_id>", methods=["GET"])
def get_hops(target_id):
    with _lock:
        data = hop_cache.get(target_id, [])
        return jsonify(data)


@app.route("/api/ping/<target_id>", methods=["GET"])
def ping_target(target_id):
    """On-demand single ping."""
    with _lock:
        t = targets.get(target_id)
    if not t:
        return jsonify({"error": "target not found"}), 404
    result = ping_host(t["host"])
    return jsonify(result)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "targets": len(targets),
        "uptime": time.time()
    })


# ── Main ─────────────────────────────────────────────────────────────────────

def start_workers():
    t1 = threading.Thread(target=ping_worker, daemon=True)
    t2 = threading.Thread(target=traceroute_worker, daemon=True)
    t1.start()
    t2.start()


init_targets()
start_workers()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Network Monitor Agent")
    parser.add_argument("--port", type=int, default=5000, help="Port to listen on")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    args = parser.parse_args()

    print(f"🔍 Network Monitor Agent running on {args.host}:{args.port}")
    print(f"📡 Monitoring {len(targets)} targets")
    app.run(host=args.host, port=args.port, debug=False)
