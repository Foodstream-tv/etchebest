#!/usr/bin/env sh

# set -e: exit on error
# set -u: treat unset variables as an error
set -eu

# Determine the host machine's primary IP address in a portable way.
# - On Linux: use `ip route` if available, otherwise fall back to `hostname -I`.
# - On macOS: use `ipconfig getifaddr` on common interfaces.
# The resulting IP address is printed to stdout.

get_host_ip_linux() {
  if command -v ip >/dev/null 2>&1; then
    # Use ip route to find the source IP for a route to a public address.
    ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for (i = 1; i <= NF; i++) if ($i == "src") {print $(i+1); exit}}'
  elif command -v hostname >/dev/null 2>&1; then
    # Fallback: use the first IP reported by hostname -I (Linux-specific but common).
    hostname -I 2>/dev/null | awk '{print $1}'
  else
    return 1
  fi
}

get_host_ip_macos() {
  # Try common Wi-Fi / Ethernet interfaces.
  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || \
    ipconfig getifaddr en1 2>/dev/null || \
    ipconfig getifaddr en2 2>/dev/null || \
    return 1
  else
    return 1
  fi
}

OS_NAME=$(uname -s 2>/dev/null || echo unknown)
HOST_IP=""

case "$OS_NAME" in
  Linux)
    HOST_IP=$(get_host_ip_linux || echo "")
    ;;
  Darwin)
    HOST_IP=$(get_host_ip_macos || echo "")
    ;;
  *)
    # Unsupported OS; leave HOST_IP empty.
    HOST_IP=""
    ;;
esac

if [ -z "$HOST_IP" ]; then
  echo "ERROR: Could not determine host IP address for OS '$OS_NAME'." >&2
  exit 1
fi

# Print the detected IP address so callers can consume it or update configs as needed.
printf '%s\n' "$HOST_IP"
#!/usr/bin/env bash
# Detect the current LAN IP (interface used to reach the internet)
# and update mobile/.env + .env so the app always hits the right host.

set -e

LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[\d.]+' | head -1)

if [[ -z "$LAN_IP" ]]; then
  echo "set-ip: could not detect LAN IP" >&2
  exit 1
fi

echo "set-ip: detected LAN IP = $LAN_IP"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_ENV="$ROOT_DIR/mobile/.env"
ROOT_ENV="$ROOT_DIR/.env"

# Update mobile/.env
if [[ -f "$MOBILE_ENV" ]]; then
  sed -i "s|EXPO_PUBLIC_API_BASE_URL=http://[^/]*/api|EXPO_PUBLIC_API_BASE_URL=http://$LAN_IP:8081/api|" "$MOBILE_ENV"
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

# Restart backend container to pick up new WEBRTC_IP (no rebuild needed)
if command -v docker &>/dev/null && docker ps --format '{{.Names}}' | grep -q 'backend-foodstream'; then
  echo "set-ip: restarting backend-foodstream..."
  docker compose -f "$ROOT_DIR/docker-compose.yml" up -d --force-recreate --no-build backend
  echo "set-ip: backend restarted"
fi

echo "set-ip: done — backend reachable at http://$LAN_IP:8081"
