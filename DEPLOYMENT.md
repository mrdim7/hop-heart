# On-Premises Deployment Guide

## Prerequisites

- **Docker** ≥ 20.10 and **Docker Compose** ≥ 2.0, **OR**
- **Node.js** ≥ 20 and a static file server (Nginx, Apache, Caddy)

---

## Option 1: Docker (Recommended)

### Quick Start

```bash
# Clone the repository
git clone <your-repo-url> network-monitor
cd network-monitor

# Build and start
docker compose up -d

# App is available at http://localhost:8080
```

### Custom Port

Edit `docker-compose.yml` and change the port mapping:

```yaml
ports:
  - "3000:80"   # Change 3000 to your desired port
```

### Production with Reverse Proxy

If running behind a reverse proxy (e.g., corporate Nginx/Apache), set the upstream to `http://localhost:8080`.

Example Nginx reverse proxy config:

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
}
```

### Managing the Container

```bash
# Stop
docker compose down

# Rebuild after updates
docker compose up -d --build

# View logs
docker compose logs -f
```

---

## Option 2: Static Build (No Docker)

### Build

```bash
npm ci
npm run build
```

This produces a `dist/` folder with static files.

### Serve with Nginx

```bash
# Copy build output
sudo cp -r dist/* /var/www/network-monitor/

# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/network-monitor
sudo ln -s /etc/nginx/sites-available/network-monitor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Serve with Node (simple)

```bash
npx serve dist -l 8080
```

---

## Option 3: Systemd Service (Linux)

After building, create `/etc/systemd/system/network-monitor.service`:

```ini
[Unit]
Description=Network Monitor
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/network-monitor
ExecStart=/usr/bin/npx serve dist -l 8080
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now network-monitor
```

---

## Firewall

Ensure the chosen port (default `8080`) is open:

```bash
# UFW
sudo ufw allow 8080/tcp

# firewalld
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

---

## Health Check

```bash
curl -f http://localhost:8080 || echo "Service down"
```
