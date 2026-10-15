#!/usr/bin/env bash
# Creates demo data through the public API: two verified accounts and a scheduled live for the host.
# Safe to run again (existing accounts are reused, an existing live is kept). Needs the backend
# running with DEV_MODE=true (the API then returns the e-mail verification code).
#
#   scripts/seed.sh                       # API at http://localhost:${BACKEND_PORT:-8081}/api
#   API_URL=http://192.168.1.40:8081/api scripts/seed.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
port="$(grep -m1 '^BACKEND_PORT=' "$ROOT_DIR/.env" 2>/dev/null | cut -d= -f2- || true)"
API_URL="${API_URL:-http://localhost:${port:-8081}/api}"
PASSWORD="${SEED_PASSWORD:-Demo1234!}"

HOST_EMAIL="demo.host@example.com"
VIEWER_EMAIL="demo.viewer@example.com"

log() { printf 'seed: %s\n' "$*"; }
die() { printf 'seed: %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null || die "curl is required"
command -v python3 >/dev/null || die "python3 is required (JSON parsing)"

json_get() { # json_get <key> reads a top-level string value from stdin ('' when absent)
  python3 -c 'import json,sys
try:
    v = json.load(sys.stdin).get(sys.argv[1], "")
except Exception:
    v = ""
print("" if v is None else v)' "$1"
}

# post <path> <json> [token] -> prints "<http_status>\n<body>"
post() {
  local path="$1" body="$2" token="${3:-}"
  # (declared separately: inside one `local` statement $body would still be unset when the array is built)
  local args=(-sS -m 15 -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' -d "$body")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  curl "${args[@]}" "$API_URL$path" || die "cannot reach the API at $API_URL (is the backend up? try 'make up')"
}
status_of() { tail -n1 <<<"$1"; }
body_of() { sed '$d' <<<"$1"; }

# account <email> <username> <first> <last> -> prints a bearer token
account() {
  local email="$1" username="$2" first="$3" last="$4" resp status body user_id code
  resp="$(post /register "$(python3 -c 'import json,sys
print(json.dumps({"email": sys.argv[1], "password": sys.argv[2], "username": sys.argv[3], "firstName": sys.argv[4],
  "lastName": sys.argv[5], "description": "Compte de démonstration pour tester Foodstream", "countryNumberPhone": 33,
  "numberPhone": "612345678", "ageConfirmed": True}))' "$email" "$PASSWORD" "$username" "$first" "$last")")"
  status="$(status_of "$resp")"; body="$(body_of "$resp")"

  if [[ "$status" == "200" ]]; then
    user_id="$(json_get userId <<<"$body")"
    code="$(json_get devCode <<<"$body")"
    [[ -n "$code" ]] || die "the API did not return a verification code: start the backend with DEV_MODE=true (set it in .env, then 'make restart')"
    resp="$(post /verify "{\"userId\":\"$user_id\",\"code\":\"$code\"}")"
    [[ "$(status_of "$resp")" == "200" ]] || die "verification failed for $email: $(body_of "$resp")"
    log "created and verified $email" >&2
    json_get token <<<"$(body_of "$resp")"
    return
  fi

  # Already registered: sign in with the demo password.
  resp="$(post /login "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")"
  [[ "$(status_of "$resp")" == "200" ]] || die "$email exists but cannot sign in with the demo password: $(body_of "$resp")"
  log "$email already exists" >&2
  json_get token <<<"$(body_of "$resp")"
}

host_token="$(account "$HOST_EMAIL" demohost Demo Host)"
[[ -n "$host_token" ]] || die "no token for the host account"
viewer_token="$(account "$VIEWER_EMAIL" demoviewer Demo Viewer)"
[[ -n "$viewer_token" ]] || die "no token for the viewer account"

scheduled_at="$(python3 -c 'import datetime
print((datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ"))')"
resp="$(post /rooms "$(python3 -c 'import json,sys
print(json.dumps({"name": "Ramen maison pas à pas", "title": "Ramen maison pas à pas", "status": "scheduled",
  "scheduledAt": sys.argv[1], "description": "Live de démonstration : bouillon, chashu et œuf mollet.",
  "tags": ["Asiatique", "Japonais"], "durationMinutes": 60}))' "$scheduled_at")" "$host_token")"
case "$(status_of "$resp")" in
  200|201) log "scheduled live created for $HOST_EMAIL" ;;
  409) log "the host already has an active or scheduled live: kept" ;;
  *) die "could not create the live: $(body_of "$resp")" ;;
esac

cat <<INFO

Demo accounts (password: $PASSWORD)
  host    $HOST_EMAIL     @demohost
  viewer  $VIEWER_EMAIL   @demoviewer
INFO
