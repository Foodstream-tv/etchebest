# Backlog issues (generated from `AUDIT_LIVE_WEBRTC.md`)

39 grouped issues (one per theme, not per finding). Each file in `issues/` is the body of one GitHub issue;
`backlog.json` holds title, labels, milestone and body. Regenerate with `python3 build.py` after editing `build.py`.

Labels: `priority:*`, `area:*`, `effort:S|M|L`, `audit`. Milestones: Phase 2 to 5 and « Qualité & tests ».

## Create them on GitHub
```bash
sudo dnf install gh
gh auth login
gh auth refresh -s project           # only needed for --project
./create.py                          # dry run: shows what would be created
./create.py --apply --project "Live & mobile roadmap"
```
Create the Project first on the web (Organisation → Projects → New project → Board). `create.py` is idempotent:
it skips an issue whose title already exists, and `--only 1,2` creates a subset.
