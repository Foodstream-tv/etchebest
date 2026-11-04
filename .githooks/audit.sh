#!/usr/bin/env bash
# Audit of potential bugs, run before every commit and every local merge (pre-commit, pre-merge-commit).
# Looks only at what is staged, and only builds/tests the zones it touches. Where the other hooks check
# style (gofmt, ESLint), this one checks that the change is not broken:
#   1. leftovers  : conflict markers, focused tests (.only), debugger, secrets, forbidden attribution lines
#   2. Go         : go build + go vet, and the tests of the packages touched (race detector)
#   3. TypeScript : tsc --noEmit for each project touched, and the Jest tests related to the staged files
# Skip once with: SKIP_AUDIT=1 git commit ...   (the CI runs the full suites anyway).
set -uo pipefail

[[ "${SKIP_AUDIT:-}" == "1" ]] && { echo "audit: ignoré (SKIP_AUDIT=1)" >&2; exit 0; }

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT" || exit 1
mapfile -t staged < <(git diff --cached --name-only --diff-filter=ACMR)
[[ ${#staged[@]} -eq 0 ]] && exit 0

status=0
fail() { printf 'audit: %s\n' "$*" >&2; status=1; }

# --- 1. Leftovers, looked for in the lines this change ADDS -----------------------------------------------
# The hooks themselves spell out the patterns they look for: they are not scanned.
added="$(git diff --cached -U0 --diff-filter=ACMR -- . ':(exclude).githooks' | grep -E '^\+[^+]|^\+$' || true)"

if grep -nE '^\+(<<<<<<< |>>>>>>> )' <<<"$added" >/dev/null; then
  fail "marqueurs de conflit non résolus (<<<<<<< / >>>>>>>)"
fi
if grep -nE '^\+.*\b(describe|it|test)\.only\(' <<<"$added" >/dev/null; then
  fail "test ciblé oublié (.only) : le reste de la suite ne tournerait plus"
fi
if grep -nE '^\+\s*debugger;?\s*$' <<<"$added" >/dev/null; then
  fail "instruction debugger oubliée"
fi
if grep -nE '^\+.*(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----)' <<<"$added" >/dev/null; then
  fail "ressemble à un secret (clé, token ou clé privée) dans les lignes ajoutées"
fi
if grep -nE '^\+.*(Generated with \[?Claude Code|🤖 Generated with|Co-Authored-By: Claude)' <<<"$added" >/dev/null; then
  fail "attribution « Generated with Claude Code » / Co-Authored-By Claude dans le contenu ajouté"
fi
for f in "${staged[@]}"; do
  case "$f" in
    .env|*/.env|.env.local|*/.env.local|*.pem|*.p12|*.keystore) fail "fichier sensible indexé : $f" ;;
  esac
done

# --- 2. Go ---------------------------------------------------------------------------------------------
go_dirs=()
for f in "${staged[@]}"; do
  [[ "$f" == backend/*.go ]] && go_dirs+=("./$(dirname "${f#backend/}")")
done
if [[ ${#go_dirs[@]} -gt 0 ]]; then
  if ! command -v go >/dev/null 2>&1; then
    echo "audit: go introuvable, contrôle Go ignoré" >&2
  else
    mapfile -t pkgs < <(printf '%s\n' "${go_dirs[@]}" | sort -u)
    echo "audit: Go (build, vet, tests de ${pkgs[*]})…" >&2
    (cd backend && go build ./... && go vet ./...) || fail "go build / go vet échoue"
    # Tests of the packages touched only, with the race detector. Tests that need a database are skipped
    # without TEST_DATABASE_DSN (the CI runs them).
    (cd backend && go test -race -count=1 "${pkgs[@]}" >/tmp/audit-gotest.$$ 2>&1) \
      || { grep -E '^(--- FAIL|FAIL|panic|WARNING: DATA RACE)' /tmp/audit-gotest.$$ | head -8 >&2; fail "go test -race échoue dans ${pkgs[*]}"; }
    rm -f /tmp/audit-gotest.$$
  fi
fi

# --- 3. TypeScript projects ---------------------------------------------------------------------------
check_ts() { # check_ts DIR
  local dir="$1" files=() f
  for f in "${staged[@]}"; do
    [[ "$f" == "$dir"/* && "$f" =~ \.(ts|tsx|js|jsx|json)$ ]] && files+=("${f#"$dir"/}")
  done
  [[ ${#files[@]} -eq 0 ]] && return 0
  if [[ ! -d "$ROOT/$dir/node_modules" ]]; then
    echo "audit: $dir/node_modules absent (npm ci), contrôle ignoré" >&2
    return 0
  fi
  echo "audit: $dir (tsc${2:+, tests liés})…" >&2
  (cd "$ROOT/$dir" && npx --no-install tsc --noEmit) || { fail "tsc échoue dans $dir"; return 1; }
  if [[ "${2:-}" == "jest" ]]; then
    local src=()
    for f in "${files[@]}"; do [[ "$f" =~ \.(ts|tsx)$ ]] && src+=("$f"); done
    if [[ ${#src[@]} -gt 0 ]]; then
      # Related tests only. The first test of a file can time out on a cold cache: the CI is the judge.
      (cd "$ROOT/$dir" && npx --no-install jest --ci --findRelatedTests --passWithNoTests "${src[@]}" >/tmp/audit-jest.$$ 2>&1) \
        || { grep -E '^(FAIL|  ●)' /tmp/audit-jest.$$ | sort -u | head -8 >&2; fail "tests Jest liés échouent dans $dir (relancer seul avant de conclure : timeout à froid possible)"; }
      rm -f /tmp/audit-jest.$$
    fi
  fi
}
check_ts mobile jest
check_ts front-web
check_ts analytics

if [[ $status -ne 0 ]]; then
  echo "audit: refusé. Corrigez, ou passez exceptionnellement avec SKIP_AUDIT=1 (ou --no-verify)." >&2
fi
exit $status
