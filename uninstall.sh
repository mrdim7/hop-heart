#!/usr/bin/env bash
# Network Monitor — Uninstall Script
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Error: Run this script with sudo."
  exit 1
fi

echo "Removing Network Monitor..."

# Docker cleanup
if [[ -f /opt/network-monitor/docker-compose.yml ]]; then
  cd /opt/network-monitor && docker compose down 2>/dev/null || true
  rm -rf /opt/network-monitor
  echo "  ✓ Docker container and files removed"
fi

# Nginx cleanup
if [[ -f /etc/nginx/sites-available/network-monitor ]]; then
  rm -f /etc/nginx/sites-enabled/network-monitor
  rm -f /etc/nginx/sites-available/network-monitor
  rm -rf /var/www/network-monitor
  systemctl reload nginx 2>/dev/null || true
  echo "  ✓ Nginx config and web files removed"
fi

echo "✅ Uninstall complete."
