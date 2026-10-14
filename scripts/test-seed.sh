#!/usr/bin/env bash
# Tests for scripts/seed.sh against a tiny fake API (no Docker, no database).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILED=0
pass() { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; FAILED=1; }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

TMP="$(mktemp -d)"
PORT_FILE="$TMP/port"
cat >"$TMP/fake_api.py" <<'PY'
import json, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

DEV = sys.argv[2] == "dev"
users, lives, codes = {}, set(), {}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, status, obj):
        data = json.dumps(obj).encode()
        self.send_response(status); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or "{}")
        p = self.path
        if p == "/api/register":
            if body["email"] in users:
                return self.send(400, {"error": "this email is already being used", "code": "EMAIL_ALREADY_EXISTS"})
            uid = "u%d" % (len(users) + 1); users[body["email"]] = uid; codes[uid] = "123456"
            out = {"message": "ok", "userId": uid, "target": "d***@example.com"}
            if DEV: out["devCode"] = codes[uid]
            return self.send(200, out)
        if p == "/api/verify":
            if body.get("code") != codes.get(body.get("userId")): return self.send(400, {"error": "invalid verification code"})
            return self.send(200, {"token": "tok-" + body["userId"]})
        if p == "/api/login":
            if body["email"] in users and body["password"] == "Demo1234!": return self.send(200, {"token": "tok-" + users[body["email"]]})
            return self.send(401, {"error": "invalid email or password"})
        if p == "/api/rooms":
            tok = self.headers.get("Authorization", "")
            if tok in lives: return self.send(409, {"error": "you already have an active or scheduled live"})
            lives.add(tok); return self.send(200, {"roomId": "r1"})
        self.send(404, {})

srv = HTTPServer(("127.0.0.1", 0), H)
open(sys.argv[1], "w").write(str(srv.server_address[1]))
srv.serve_forever()
PY

start_api() { # start_api <dev|nodev>
  rm -f "$PORT_FILE"; python3 "$TMP/fake_api.py" "$PORT_FILE" "$1" & API_PID=$!
  for _ in $(seq 50); do [[ -s "$PORT_FILE" ]] && break; sleep 0.1; done
  export API_URL="http://127.0.0.1:$(cat "$PORT_FILE")/api"
}
stop_api() { kill "$API_PID" 2>/dev/null; wait "$API_PID" 2>/dev/null; }
trap 'stop_api 2>/dev/null; rm -rf "$TMP"' EXIT

echo "seed.sh"
start_api dev
OUT1="$("$HERE/seed.sh" 2>&1)"; RC1=$?
check "first run succeeds"                        '[[ $RC1 -eq 0 ]]'
check "creates and verifies both accounts"        '[[ "$(grep -c "created and verified" <<<"$OUT1")" == "2" ]]'
check "schedules a live for the host"             'grep -q "scheduled live created" <<<"$OUT1"'
check "prints the demo credentials"               'grep -q "demo.host@example.com" <<<"$OUT1" && grep -q "Demo1234!" <<<"$OUT1"'

OUT2="$("$HERE/seed.sh" 2>&1)"; RC2=$?
check "second run succeeds (idempotent)"          '[[ $RC2 -eq 0 ]]'
check "reuses the existing accounts"              '[[ "$(grep -c "already exists" <<<"$OUT2")" == "2" ]]'
check "keeps the existing live (409 is not fatal)" 'grep -q "already has an active or scheduled live" <<<"$OUT2"'
stop_api

start_api nodev
OUT3="$("$HERE/seed.sh" 2>&1)"; RC3=$?
check "explains DEV_MODE when no verification code is returned" '[[ $RC3 -ne 0 ]] && grep -q "DEV_MODE=true" <<<"$OUT3"'
stop_api

API_URL="http://127.0.0.1:9/api" "$HERE/seed.sh" >"$TMP/out4" 2>&1; RC4=$?
check "fails clearly when the API is unreachable" '[[ $RC4 -ne 0 ]] && grep -q "cannot reach the API" "$TMP/out4"'

exit $FAILED
