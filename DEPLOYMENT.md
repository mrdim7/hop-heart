# On-Premises Deployment Guide — Ubuntu 24.04

## Prerequisites

- **Ubuntu 24.04 LTS** (Noble Numbat) — fresh or existing installation
- Root / sudo access
- Minimum 1 CPU, 512 MB RAM, 1 GB disk

---

## Quick Install (Recommended)

```bash
# Clone the repository
git clone <your-repo-url> network-monitor
cd network-monitor

# Docker method (installs Docker if needed)
sudo bash install.sh --method docker --port 8080

# OR: Static Nginx method (installs Node 20 + Nginx)
sudo bash install.sh --method static --port 8080
```

The installer handles all dependencies, builds the app, configures the firewall, and starts the service.

### Uninstall

```bash
sudo bash uninstall.sh
```

---

## Manual Installation

### Option 1: Docker

```bash
# Install Docker
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc > /dev/null
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu noble stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Clone and start
git clone <your-repo-url> network-monitor
cd network-monitor
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
