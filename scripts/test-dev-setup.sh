#!/usr/bin/env bash
# Tests for scripts/dev-setup.sh, run in a throw-away project root. No Docker needed.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/dev-setup.sh"
FAILED=0
pass() { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; FAILED=1; }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

new_root() { # new_root -> prints a temp root containing an .env.example
  local d; d="$(mktemp -d)"
  cat >"$d/.env.example" <<'ENV'
BACKEND_PORT=8081
JWT_SECRET=
WEBRTC_IP=127.0.0.1
DEV_MODE=false
GOOGLE_REDIRECT_URI=http://localhost:8081/api/auth/google/callback?x=1&y=2
ENV
  printf '%s' "$d"
}
env_of() { grep -m1 "^$2=" "$1/.env" | cut -d= -f2-; }
# keep the tests independent from the machine's network: pretend this is the detected address
export PATH="$(mktemp -d):$PATH"
cat >"${PATH%%:*}/ip" <<'SH'
#!/usr/bin/env bash
echo "1.1.1.1 via 192.168.1.1 dev eth0 src 192.168.1.40 uid 1000"
SH
chmod +x "${PATH%%:*}/ip"

echo "dev-setup.sh"

ROOT="$(new_root)"
FOODSTREAM_ROOT="$ROOT" "$SCRIPT" >/dev/null 2>&1
check "creates .env from the example"            '[[ -f "$ROOT/.env" ]]'
check "turns DEV_MODE on for a new .env"         '[[ "$(env_of "$ROOT" DEV_MODE)" == "true" ]]'
check "generates a 64-char JWT secret"           '[[ "$(env_of "$ROOT" JWT_SECRET)" =~ ^[a-f0-9]{64}$ ]]'
check "points WEBRTC_IP at the LAN address"      '[[ "$(env_of "$ROOT" WEBRTC_IP)" == "192.168.1.40" ]]'
check "keeps values containing = and &"          '[[ "$(env_of "$ROOT" GOOGLE_REDIRECT_URI)" == "http://localhost:8081/api/auth/google/callback?x=1&y=2" ]]'

SECRET="$(env_of "$ROOT" JWT_SECRET)"
FOODSTREAM_ROOT="$ROOT" "$SCRIPT" >/dev/null 2>&1
check "is idempotent: the JWT secret is kept"    '[[ "$(env_of "$ROOT" JWT_SECRET)" == "$SECRET" ]]'

ROOT2="$(new_root)"
printf 'DEV_MODE=false\nJWT_SECRET=mine\nWEBRTC_IP=203.0.113.9\n' >"$ROOT2/.env"
FOODSTREAM_ROOT="$ROOT2" "$SCRIPT" >/dev/null 2>&1
check "never overrides an existing DEV_MODE"     '[[ "$(env_of "$ROOT2" DEV_MODE)" == "false" ]]'
check "never overrides an existing JWT secret"   '[[ "$(env_of "$ROOT2" JWT_SECRET)" == "mine" ]]'
check "leaves a deliberate public WEBRTC_IP"     '[[ "$(env_of "$ROOT2" WEBRTC_IP)" == "203.0.113.9" ]]'

ROOT3="$(new_root)"
printf 'WEBRTC_IP=192.168.1.99\n' >"$ROOT3/.env"
FOODSTREAM_ROOT="$ROOT3" "$SCRIPT" --ip-only >/dev/null 2>&1
check "--ip-only refreshes a stale LAN address"  '[[ "$(env_of "$ROOT3" WEBRTC_IP)" == "192.168.1.40" ]]'
check "--ip-only does not touch other keys"      '! grep -q "^JWT_SECRET=" "$ROOT3/.env"'

FOODSTREAM_ROOT="$ROOT3" "$SCRIPT" --nope >/dev/null 2>&1
check "rejects an unknown option"                '[[ $? -eq 2 ]]'

EMPTY="$(mktemp -d)"
FOODSTREAM_ROOT="$EMPTY" "$SCRIPT" >/dev/null 2>&1
check "fails clearly without .env.example"       '[[ $? -ne 0 ]]'

exit $FAILED
