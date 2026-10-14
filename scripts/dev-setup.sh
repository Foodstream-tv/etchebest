#!/usr/bin/env bash
# Prepares the local development environment. Safe to run any number of times.
#
#   scripts/dev-setup.sh            create .env if missing (JWT secret, DEV_MODE), set WEBRTC_IP, check the API port
#   scripts/dev-setup.sh --ip-only  only refresh WEBRTC_IP (and restart the backend if it changed and is running)
#
# FOODSTREAM_ROOT overrides the project root (used by the tests).
set -euo pipefail

ROOT_DIR="${FOODSTREAM_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="$ROOT_DIR/.env"
MODE="${1:-all}"

log() { printf 'dev-setup: %s\n' "$*"; }

get_env() { # get_env KEY -> value ('' when absent)
  [[ -f "$ENV_FILE" ]] || return 0
  grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- || true
}

set_env() { # set_env KEY VALUE (portable: no sed -i, which differs between GNU and BSD)
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  if grep -q "^${key}=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$value" 'BEGIN { FS = OFS = "=" } $1 == k { print k "=" v; next } { print }' "$ENV_FILE" >"$tmp"
  else
    cp "$ENV_FILE" "$tmp"
    printf '%s=%s\n' "$key" "$value" >>"$tmp"
  fi
  cat "$tmp" >"$ENV_FILE"
  rm -f "$tmp"
}

detect_ip() { # LAN address of the interface used to reach the internet
  local ip=""
  if command -v ip >/dev/null 2>&1; then
    ip="$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for (i = 1; i <= NF; i++) if ($i == "src") {print $(i+1); exit}}')"
  fi
  if [[ -z "$ip" ]] && command -v ipconfig >/dev/null 2>&1; then
    ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  fi
  if [[ -z "$ip" ]] && command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi
  printf '%s' "$ip"
}

is_loopback() { [[ -z "$1" || "$1" == 127.* || "$1" == "localhost" ]]; }
is_private_ip() { [[ "$1" =~ ^10\. || "$1" =~ ^192\.168\. || "$1" =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]]; }

ensure_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    return 0
  fi
  if [[ ! -f "$ROOT_DIR/.env.example" ]]; then
    log "no .env and no .env.example in $ROOT_DIR" >&2
    exit 1
  fi
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
  # Local development: verification codes are printed by the backend (and offered by the mobile app).
  set_env DEV_MODE true
  log "created .env from .env.example (DEV_MODE=true)"
}

ensure_jwt_secret() {
  if [[ -n "$(get_env JWT_SECRET)" ]]; then
    return 0
  fi
  local secret
  if command -v openssl >/dev/null 2>&1; then
    secret="$(openssl rand -hex 32)"
  else
    secret="$(LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 64)"
  fi
  set_env JWT_SECRET "$secret"
  log "generated JWT_SECRET"
}

# Returns 0 when WEBRTC_IP was changed. A value chosen on purpose (public IP, hostname) is left alone:
# only an unset, loopback or private-LAN value follows the current network.
update_webrtc_ip() {
  local detected current
  detected="$(detect_ip)"
  current="$(get_env WEBRTC_IP)"

  if [[ -z "$detected" ]]; then
    log "could not detect the LAN IP, WEBRTC_IP stays '${current:-unset}'" >&2
    return 1
  fi
  if [[ "$current" == "$detected" ]]; then
    log "WEBRTC_IP is already $detected"
    return 1
  fi
  if is_loopback "$current" || is_private_ip "$current"; then
    set_env WEBRTC_IP "$detected"
    log "WEBRTC_IP: ${current:-unset} -> $detected"
    return 0
  fi
  log "WEBRTC_IP=$current looks intentional (not a LAN address), left untouched (detected LAN IP: $detected)"
  return 1
}

check_api_port() {
  local port
  port="$(get_env BACKEND_PORT)"
  port="${port:-8081}"

  local listening=""
  if command -v ss >/dev/null 2>&1; then
    listening="$(ss -ltn "sport = :$port" 2>/dev/null | tail -n +2)"
  elif command -v lsof >/dev/null 2>&1; then
    listening="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | tail -n +2)"
  fi
  [[ -z "$listening" ]] && return 0

  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^backend-foodstream$'; then
    return 0 # our own backend, already up
  fi
  log "port $port is already in use by another process (often a Metro bundler started on its default port 8081)." >&2
  log "stop it, or run Metro on another port: 'make mobile' uses 8082." >&2
  return 1
}

restart_backend_if_running() {
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^backend-foodstream$'; then
    log "restarting backend-foodstream to pick up the new WEBRTC_IP..."
    docker compose -f "$ROOT_DIR/docker-compose.yml" up -d --force-recreate --no-build backend
  fi
}

case "$MODE" in
  --ip-only)
    ensure_env_file
    if update_webrtc_ip; then restart_backend_if_running; fi
    ;;
  all)
    ensure_env_file
    ensure_jwt_secret
    update_webrtc_ip || true
    check_api_port
    ;;
  *)
    log "unknown option '$MODE' (use no argument or --ip-only)" >&2
    exit 2
    ;;
esac
