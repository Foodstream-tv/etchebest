#!/usr/bin/env python3
"""Creates labels, milestones and the 39 audit issues on GitHub with the gh CLI.

  ./create.py                       # dry run: prints what would be created
  ./create.py --apply               # creates everything (skips issues whose title already exists)
  ./create.py --apply --project "Live & mobile roadmap"   # also adds each issue to that GitHub Project
  ./create.py --apply --only 1,2,3  # only some issues (numbers from backlog.json)

Environment: REPO (default Foodstream-tv/etchebest). Needs `gh auth login` and, for --project,
`gh auth refresh -s project`.
"""
import argparse, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get("REPO", "Foodstream-tv/etchebest")

# Same scheme as the existing "Foodstream" project (P0..P3, S/M/L). Labels that already exist are left
# untouched (colour, description); only the missing ones are created.
LABELS = {
    "P0": "b60205", "P1": "d93f0b", "P2": "fbca04", "P3": "0e8a16",
    "S": "c5def5", "M": "bfd4f2", "L": "a2c4e8",
    "area:backend": "1d76db", "area:mobile": "5319e7", "area:web": "0052cc", "area:infra": "006b75",
    "audit": "ededed",
}
MILESTONE_DESC = {
    "Phase 2 – Fiabilité du live": "Grâce de déconnexion, réconciliation au démarrage, verrous, supervision FFmpeg",
    "Phase 3 – Autorisation et robustesse": "Droits de rejoindre, limites, validation, sécurité et durcissement",
    "Phase 4 – Mobile diffusion": "Arrière-plan, écran hôte, multi-flux, audio, lecture HLS, config de prod",
    "Phase 5 – Échelle et qualité vidéo": "TURN, transcodage, fenêtre HLS, compteurs, replays",
    "Qualité & tests": "CI et couverture de tests",
}

def sh(cmd, check=True, capture=True):
    return subprocess.run(cmd, check=check, text=True, capture_output=capture)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--project", default=None)
    ap.add_argument("--only", default=None)
    args = ap.parse_args()

    items = json.load(open(os.path.join(HERE, "backlog.json")))
    if args.only:
        wanted = {int(x) for x in args.only.split(",")}
        items = [i for i in items if i["n"] in wanted]

    print(f"Repo: {REPO}   mode: {'APPLY' if args.apply else 'dry run'}   issues: {len(items)}")

    if args.apply:
        sh(["gh", "auth", "status"])
        have = {l["name"] for l in json.loads(sh(["gh", "label", "list", "--repo", REPO, "--limit", "300", "--json", "name"]).stdout)}
        for name, color in LABELS.items():
            if name not in have:
                sh(["gh", "label", "create", name, "--color", color, "--repo", REPO])
        existing_ms = {m["title"] for m in json.loads(sh(["gh", "api", f"repos/{REPO}/milestones?state=all&per_page=100"]).stdout)}
        for title, desc in MILESTONE_DESC.items():
            if title not in existing_ms:
                sh(["gh", "api", f"repos/{REPO}/milestones", "-f", f"title={title}", "-f", f"description={desc}"])
        existing = {i["title"] for i in json.loads(sh(["gh", "issue", "list", "--repo", REPO, "--state", "all", "--limit", "500", "--json", "title"]).stdout)}
    else:
        existing = set()

    created = 0
    for it in items:
        tag = f"#{it['n']:02d} [{it['milestone']}] {it['title']}"
        if it["title"] in existing:
            print("skip (exists):", tag)
            continue
        if not args.apply:
            print("would create:", tag, "|", ",".join(it["labels"]))
            continue
        cmd = ["gh", "issue", "create", "--repo", REPO, "--title", it["title"],
               "--body-file", os.path.join(HERE, it["file"]), "--label", ",".join(it["labels"]),
               "--milestone", it["milestone"]]
        if args.project:
            cmd += ["--project", args.project]
        # the body file starts with a "# title" line: strip it, GitHub already shows the title
        body = open(os.path.join(HERE, it["file"])).read().split("\n", 2)[2]
        tmp = os.path.join(HERE, ".body.tmp")
        open(tmp, "w").write(body)
        cmd[cmd.index("--body-file") + 1] = tmp
        url = sh(cmd).stdout.strip()
        os.remove(tmp)
        created += 1
        print("created:", tag, "->", url)
    print(f"done, {created} created")

if __name__ == "__main__":
    sys.exit(main())
