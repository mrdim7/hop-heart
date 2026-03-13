#!/usr/bin/env bash
# Network Monitor — Ubuntu 24.04 Installation Script
# Usage: sudo bash install.sh [--port 8080] [--method docker|static]
set -euo pipefail

PORT=8080
METHOD="docker"
INSTALL_DIR="/opt/network-monitor"
APP_USER="www-data"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --port)   PORT="$2"; shift 2 ;;
    --method) METHOD="$2"; shift 2 ;;
    *)        echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "============================================"
echo " Network Monitor Installer — Ubuntu 24.04"
echo " Method: $METHOD | Port: $PORT"
echo "============================================"

# Check Ubuntu version
if ! grep -q "24.04" /etc/os-release 2>/dev/null; then
  echo "⚠  Warning: This script is designed for Ubuntu 24.04. Proceed at your own risk."
fi

# Check root
if [[ $EUID -ne 0 ]]; then
  echo "Error: Run this script with sudo."
  exit 1
fi

install_docker_method() {
  echo "→ Installing Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release

  # Add Docker GPG key & repo
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi

  if [[ ! -f /etc/apt/sources.list.d/docker.list ]]; then
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
      https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
  fi

  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

  systemctl enable --now docker

  echo "→ Setting up application..."
  mkdir -p "$INSTALL_DIR"
  cp -r . "$INSTALL_DIR/"

  # Update port in docker-compose
  sed -i "s/\"8080:80\"/\"${PORT}:80\"/" "$INSTALL_DIR/docker-compose.yml"

  cd "$INSTALL_DIR"
  docker compose up -d --build

  echo ""
  echo "✅ Network Monitor running at http://$(hostname -I | awk '{print $1}'):${PORT}"
  echo "   Manage with: cd $INSTALL_DIR && docker compose [up -d|down|logs -f]"
}

install_static_method() {
  echo "→ Installing Node.js 20 and Nginx..."
  apt-get update -qq

  # Node.js 20 via NodeSource
  if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
  fi

  apt-get install -y -qq nginx

  echo "→ Building application..."
  npm ci --quiet
  npm run build

  echo "→ Deploying to Nginx..."
  mkdir -p /var/www/network-monitor
  cp -r dist/* /var/www/network-monitor/

  # Write Nginx site config
  cat > /etc/nginx/sites-available/network-monitor <<NGINX
server {
    listen ${PORT};
    server_name _;
    root /var/www/network-monitor;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;
}
NGINX

  # Enable site
  ln -sf /etc/nginx/sites-available/network-monitor /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx

  echo ""
  echo "✅ Network Monitor running at http://$(hostname -I | awk '{print $1}'):${PORT}"
  echo "   Web root: /var/www/network-monitor"
  echo "   Config:   /etc/nginx/sites-available/network-monitor"
}

# Configure firewall
configure_firewall() {
  if command -v ufw &>/dev/null; then
    echo "→ Configuring UFW firewall..."
    ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true
  fi
}

# Run
case $METHOD in
  docker) install_docker_method ;;
  static) install_static_method ;;
  *)      echo "Error: --method must be 'docker' or 'static'"; exit 1 ;;
esac

configure_firewall

echo ""
echo "Installation complete. Run 'curl -f http://localhost:${PORT}' to verify."
