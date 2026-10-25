#!/usr/bin/env bash
# Weekly summary of the repository, posted as a comment on the "Point hebdomadaire" issue
# (created on the first run). Used by .github/workflows/weekly-report.yml every Monday.
#
#   scripts/weekly-report.sh             post the report (needs gh authenticated, issues: write)
#   scripts/weekly-report.sh --dry-run   print it without posting anything
#
# REPO overrides the repository (default: Foodstream-tv/etchebest), DAYS the period (default: 7).
set -euo pipefail

REPO="${REPO:-Foodstream-tv/etchebest}"
DAYS="${DAYS:-7}"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true
LABEL="point-hebdo"
TITLE="Point hebdomadaire"

since="$(date -u -d "$DAYS days ago" +%Y-%m-%d)"
today="$(date -u +%Y-%m-%d)"

merged="$(gh pr list -R "$REPO" --state merged --search "merged:>=$since" --limit 200 \
  --json number,title,author)"
closed_issues="$(gh issue list -R "$REPO" --state closed --search "closed:>=$since" --limit 200 --json number)"
opened_issues="$(gh issue list -R "$REPO" --state all --search "created:>=$since" --limit 200 --json number)"
open_issues="$(gh issue list -R "$REPO" --state open --limit 1000 --json number,assignees,milestone,labels)"
open_prs="$(gh pr list -R "$REPO" --state open --limit 200 --json number,title,createdAt,author,isDraft)"
milestones="$(gh api "repos/$REPO/milestones?state=open&per_page=100")"

count() { jq 'length' <<<"$1"; }

# Open issues, without the report's own issue.
open_issues="$(jq --arg l "$LABEL" '[.[] | select(all(.labels[]; .name != $l))]' <<<"$open_issues")"

report="$(
  cat <<MD
## Semaine du $since au $today

| | |
| :--- | ---: |
| PR mergées | $(count "$merged") |
| Issues ouvertes / fermées | $(count "$opened_issues") / $(count "$closed_issues") |
| Issues ouvertes au total | $(count "$open_issues") |
| … sans personne assignée | $(jq '[.[] | select(.assignees | length == 0)] | length' <<<"$open_issues") |
| … hors milestone | $(jq '[.[] | select(.milestone == null)] | length' <<<"$open_issues") |
| PR ouvertes (dont Dependabot) | $(count "$open_prs") ($(jq '[.[] | select(.author.login | test("dependabot"))] | length' <<<"$open_prs")) |

### PR mergées
$(jq -r 'if length == 0 then "_Aucune._" else (sort_by(.number) | .[] | "- #\(.number) \(.title) (@\(.author.login))") end' <<<"$merged")

### PR ouvertes depuis plus d'une semaine
$(jq -r --arg since "$since" '[.[] | select(.createdAt[:10] < $since and (.author.login | test("dependabot") | not))]
  | if length == 0 then "_Aucune._" else (sort_by(.createdAt) | .[]
  | "- #\(.number) \(.title) (@\(.author.login), ouverte le \(.createdAt[:10])\(if .isDraft then ", brouillon" else "" end))") end' <<<"$open_prs")

### Milestones
$(jq -r 'if length == 0 then "_Aucun milestone ouvert._" else (sort_by(.title) | .[]
  | "- **\(.title)** : \(.closed_issues) / \(.open_issues + .closed_issues) issues fermées") end' <<<"$milestones")
MD
)"

if $DRY_RUN; then
  printf '%s\n' "$report"
  exit 0
fi

issue="$(gh issue list -R "$REPO" --state open --label "$LABEL" --limit 1 --json number --jq '.[0].number // empty')"
if [[ -z "$issue" ]]; then
  gh label create "$LABEL" -R "$REPO" --color 0E8A16 --description "Point hebdomadaire automatique" 2>/dev/null || true
  issue_url="$(gh issue create -R "$REPO" --title "$TITLE" --label "$LABEL" --body \
    "Chaque lundi, le workflow « Weekly report » publie ici le point de la semaine (PR mergées, issues, PR qui traînent, milestones). Abonnez-vous à cette issue pour le recevoir.")"
  issue="${issue_url##*/}"
fi

gh issue comment "$issue" -R "$REPO" --body "$report" >/dev/null
echo "weekly-report: posted on #$issue"
