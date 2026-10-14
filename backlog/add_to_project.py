#!/usr/bin/env python3
"""Adds every issue labelled `audit` to a GitHub Project (skips the ones already in it).

  ./add_to_project.py                       # dry run: shows how many are missing
  ./add_to_project.py --apply               # adds the missing ones
  ./add_to_project.py --apply --project "Foodstream"   # other project title

Needs `gh auth refresh -s project`. Environment: REPO (default Foodstream-tv/etchebest), OWNER (default Foodstream-tv).
"""
import argparse, json, os, subprocess, sys, time

REPO = os.environ.get("REPO", "Foodstream-tv/etchebest")
OWNER = os.environ.get("OWNER", "Foodstream-tv")

def gh(*cmd):
    r = subprocess.run(["gh", *cmd], text=True, capture_output=True)
    if r.returncode != 0:
        sys.exit(f"gh {' '.join(cmd)}\n{r.stderr.strip()}")
    return r.stdout

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--project", default="Foodstream", help="project title")
    ap.add_argument("--label", default="audit")
    args = ap.parse_args()

    projects = json.loads(gh("project", "list", "--owner", OWNER, "--limit", "100", "--format", "json"))["projects"]
    match = [p for p in projects if p["title"] == args.project]
    if not match:
        sys.exit("Project not found. Available: " + ", ".join(f"{p['title']} (#{p['number']})" for p in projects))
    number = str(match[0]["number"])

    issues = json.loads(gh("issue", "list", "--repo", REPO, "--label", args.label, "--state", "all", "--limit", "500", "--json", "url,title,number"))
    items = json.loads(gh("project", "item-list", number, "--owner", OWNER, "--limit", "1000", "--format", "json"))["items"]
    present = {(i.get("content") or {}).get("url") for i in items}
    missing = [i for i in issues if i["url"] not in present]

    print(f"Project '{args.project}' (#{number}): {len(issues)} issues labelled '{args.label}', {len(issues) - len(missing)} already in it, {len(missing)} missing")
    for n, i in enumerate(sorted(missing, key=lambda x: x["number"]), 1):
        if not args.apply:
            print(f"would add #{i['number']} {i['title']}")
            continue
        gh("project", "item-add", number, "--owner", OWNER, "--url", i["url"])
        print(f"added {n}/{len(missing)}: #{i['number']}")
        time.sleep(1.0)  # stay below GitHub's secondary rate limit
    if not missing:
        print("nothing to do")

if __name__ == "__main__":
    main()
