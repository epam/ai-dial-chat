#!/usr/bin/env python3
# Discover agents whose manifests match a given GitHub event, honoring kill-switch vars.
# Output: single-line JSON array of matched agent names, e.g. ["code-review"].
import argparse
import glob
import json
import os
import sys

try:
    import yaml
except ImportError:
    sys.stderr.write("::error::PyYAML required. Run: pip install pyyaml\n")
    sys.exit(2)


def matches_trigger(triggers, event):
    for t in triggers or []:
        if isinstance(t, str) and t == event:
            return True
        if isinstance(t, dict) and t.get("on") == event:
            return True
    return False


def kill_switch_var(name):
    return "STAGE_" + name.upper().replace("-", "_") + "_ENABLED"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("event", help="GitHub event name (e.g. pull_request)")
    p.add_argument("--vars", help="Path to JSON dump of the vars context")
    p.add_argument("--root", default=".", help="Repo root (default: cwd)")
    args = p.parse_args()

    vars_dict = {}
    if args.vars and os.path.exists(args.vars):
        with open(args.vars) as f:
            vars_dict = json.load(f) or {}

    matched = []
    for path in sorted(glob.glob(f"{args.root}/agents/*/agent.yml")):
        try:
            with open(path) as f:
                manifest = yaml.safe_load(f) or {}
        except Exception as e:
            sys.stderr.write(f"::warning::skipping {path}: {e}\n")
            continue

        name = manifest.get("name")
        if not name:
            continue

        if not matches_trigger(manifest.get("triggers"), args.event):
            continue

        ks_var = manifest.get("kill_switch_var") or kill_switch_var(name)
        if vars_dict.get(ks_var) == "false":
            sys.stderr.write(f"::notice::agent {name} disabled via {ks_var}=false\n")
            continue

        matched.append(name)

    print(json.dumps(matched))


if __name__ == "__main__":
    main()
