# Network Monitor — On-Premises Deployment (Ubuntu 24.04)

## Architecture

```
┌─────────────────┐     HTTP/REST      ┌──────────────────┐
│  Browser (UI)   │ ◄───────────────── │  Python Agent    │
│  React + Vite   │     polling        │  (ping/traceroute)│
│  :8080          │                    │  :5000           │
└─────────────────┘                    └──────────────────┘
```

The UI is a static React app. The **monitoring agent** is a Python Flask server that
runs real `ping` and `traceroute` commands and exposes the results via REST API.

When the agent is unreachable, the UI falls back to simulated data automatically.

---

## Prerequisites

- **Ubuntu 24.04 LTS** (Noble Numbat) — fresh or existing installation
- Root / sudo access
- Minimum 1 CPU, 512 MB RAM, 1 GB disk

---

## Quick Start (Docker — Recommended)

```bash
git clone <repo-url> && cd network-monitor
sudo docker compose up -d --build

# UI:    http://localhost:8080
# Agent: http://localhost:5000/api/health
```

## Quick Start (Automated Script)

```bash
chmod +x install.sh
sudo ./install.sh --method docker    # Docker-based
# or
sudo ./install.sh --method static    # Nginx + systemd
```

---

## Agent Setup (Manual)

The agent requires root or `CAP_NET_RAW` for ICMP operations.

### Prerequisites

```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv iputils-ping traceroute dnsutils
```

### Install & Run

```bash
cd agent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run directly (development)
sudo python3 monitor.py --port 5000

# Run with gunicorn (production)
sudo venv/bin/gunicorn -w 2 -b 0.0.0.0:5000 monitor:app
```

### Agent Systemd Service

```bash
sudo tee /etc/systemd/system/network-monitor-agent.service > /dev/null <<EOF
[Unit]
Description=Network Monitor Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/network-monitor/agent
ExecStart=/opt/network-monitor/agent/venv/bin/gunicorn -w 2 -b 0.0.0.0:5000 monitor:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now network-monitor-agent
```

---

## UI Setup (Manual)

### Build

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Build the frontend (point to agent URL)
npm install
VITE_AGENT_URL=http://YOUR_SERVER_IP:5000 npm run build
```

### Nginx Configuration

```bash
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/network-monitor <<EOF
server {
    listen 8080;
    server_name _;
    root /var/www/network-monitor;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API requests to agent
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
EOF

sudo mkdir -p /var/www/network-monitor
sudo cp -r dist/* /var/www/network-monitor/
sudo ln -sf /etc/nginx/sites-available/network-monitor /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

> **Tip**: When using the Nginx proxy for `/api/`, set `VITE_AGENT_URL` to empty string
> so the UI calls `/api/...` directly through Nginx on the same origin.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_AGENT_URL` | `http://localhost:5000` | Agent API base URL (set at build time) |

### Agent Default Targets

Edit `agent/monitor.py` → `DEFAULT_TARGETS` list to change monitoring targets.
You can also manage targets at runtime via the API:

```bash
# Add a target
curl -X POST http://localhost:5000/api/targets \
  -H "Content-Type: application/json" \
  -d '{"host": "example.com", "label": "Example"}'

# List targets
curl http://localhost:5000/api/targets

# Delete a target
curl -X DELETE http://localhost:5000/api/targets/101
```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Agent health check |
| `/api/targets` | GET | List all targets |
| `/api/targets` | POST | Add a target `{host, label}` |
| `/api/targets/:id` | DELETE | Remove a target |
| `/api/timeline/:id` | GET | Get latency timeline data |
| `/api/hops/:id` | GET | Get traceroute hops |
| `/api/ping/:id` | GET | On-demand single ping |

---

## Firewall

```bash
sudo ufw allow 8080/tcp   # UI
sudo ufw allow 5000/tcp   # Agent API (only if accessed directly)
```

---

## Production with TLS (Reverse Proxy)

```nginx
server {
    listen 443 ssl;
    server_name monitor.yourcompany.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Uninstall

```bash
chmod +x uninstall.sh
sudo ./uninstall.sh
```
