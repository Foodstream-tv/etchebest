#!/usr/bin/env bash
# Detect the current LAN IP (interface used to reach the internet)
# and update mobile/.env + .env so the app always hits the right host.

set -euo pipefail

get_host_ip() {
  if command -v ip >/dev/null 2>&1; then
    ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for (i = 1; i <= NF; i++) if ($i == "src") {print $(i+1); exit}}'
  elif command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}'
  elif command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
  else
    return 1
  fi
}

LAN_IP=$(get_host_ip || true)

if [[ -z "$LAN_IP" ]]; then
  echo "set-ip: could not detect LAN IP, defaulting to 127.0.0.1" >&2
  LAN_IP="127.0.0.1"
fi

echo "set-ip: detected LAN IP = $LAN_IP"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_ENV="$ROOT_DIR/mobile/.env"
ROOT_ENV="$ROOT_DIR/.env"

# Update mobile/.env if present
if [[ -f "$MOBILE_ENV" ]]; then
  if grep -q '^EXPO_PUBLIC_API_BASE_URL=' "$MOBILE_ENV"; then
    sed -i "s|EXPO_PUBLIC_API_BASE_URL=http://[^/]*/api|EXPO_PUBLIC_API_BASE_URL=http://$LAN_IP:8081/api|" "$MOBILE_ENV"
  else
    echo "EXPO_PUBLIC_API_BASE_URL=http://$LAN_IP:8081/api" >> "$MOBILE_ENV"
  fi
  echo "set-ip: updated $MOBILE_ENV"
fi

# Update root .env — upsert WEBRTC_IP line
if [[ -f "$ROOT_ENV" ]]; then
  if grep -q '^WEBRTC_IP=' "$ROOT_ENV"; then
    sed -i "s|^WEBRTC_IP=.*|WEBRTC_IP=$LAN_IP|" "$ROOT_ENV"
  else
    echo "WEBRTC_IP=$LAN_IP" >> "$ROOT_ENV"
  fi
  echo "set-ip: updated $ROOT_ENV"
fi

# Restart backend container to pick up new WEBRTC_IP if already running
if command -v docker &>/dev/null && docker ps --format '{{.Names}}' | grep -q 'backend-foodstream'; then
  echo "set-ip: restarting backend-foodstream..."
  docker compose -f "$ROOT_DIR/docker-compose.yml" up -d --force-recreate --no-build backend
  echo "set-ip: backend restarted"
fi

echo "set-ip: done — backend reachable at http://$LAN_IP:8081"
