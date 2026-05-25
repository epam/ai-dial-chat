#!/usr/bin/env python3
# Discover agents whose manifests match a given GitHub event, honoring
# kill-switch vars, and group them into topologically-sorted rounds based on
# their declared `needs:` dependencies.
#
# Output: JSON object with round1..roundN arrays. Each entry is
# {"name": "<agent>", "needs": ["<upstream>", ...]}. Empty arrays for
# unused rounds. Dispatcher caps active rounds at MAX_ROUNDS.
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

MAX_ROUNDS = 3


def matches_trigger(triggers, event):
    for t in triggers or []:
        if isinstance(t, str) and t == event:
            return True
        if isinstance(t, dict) and t.get("on") == event:
            return True
    return False


def kill_switch_var(name):
    return "STAGE_" + name.upper().replace("-", "_") + "_ENABLED"


def discover_agents(root, event, vars_dict):
    matched = {}
    for path in sorted(glob.glob(f"{root}/agents/*/agent.yml")):
        if os.path.basename(os.path.dirname(path)).startswith("_"):
            continue
        try:
            with open(path) as f:
                manifest = yaml.safe_load(f) or {}
        except Exception as e:
            sys.stderr.write(f"::warning::skipping {path}: {e}\n")
            continue

        name = manifest.get("name")
        if not name:
            continue
        if not matches_trigger(manifest.get("triggers"), event):
            continue

        ks_var = manifest.get("kill_switch_var") or kill_switch_var(name)
        if vars_dict.get(ks_var) == "false":
            sys.stderr.write(f"::notice::agent {name} disabled via {ks_var}=false\n")
            continue

        needs = manifest.get("needs") or []
        if not isinstance(needs, list):
            sys.stderr.write(f"::warning::agent {name} has invalid `needs:` (must be list); ignoring\n")
            needs = []

        matched[name] = {"name": name, "needs": needs}
    return matched


def topo_sort_rounds(agents):
    """Group agents into topologically-sorted rounds.

    Returns: list of rounds; each round is a list of agent dicts.
    Agents whose `needs` reference an unavailable agent (e.g., killed
    upstream) are pruned with a warning. Cycles fail loudly.
    """
    available = set(agents)

    pruned = {}
    for name, a in agents.items():
        missing = set(a["needs"]) - available
        if missing:
            sys.stderr.write(
                f"::warning::skipping {name}; needed agents not available: {sorted(missing)}\n"
            )
            continue
        pruned[name] = a

    remaining = dict(pruned)
    processed = set()
    rounds = []
    while remaining:
        ready = [a for a in remaining.values() if not (set(a["needs"]) - processed)]
        if not ready:
            sys.stderr.write(f"::error::Cycle detected in agent `needs:` deps: {sorted(remaining)}\n")
            sys.exit(1)
        ready.sort(key=lambda a: a["name"])
        rounds.append(ready)
        for a in ready:
            del remaining[a["name"]]
            processed.add(a["name"])
    return rounds


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

    agents = discover_agents(args.root, args.event, vars_dict)
    rounds = topo_sort_rounds(agents)

    if len(rounds) > MAX_ROUNDS:
        overflow = sum(len(r) for r in rounds[MAX_ROUNDS:])
        sys.stderr.write(
            f"::error::dependency chain has {len(rounds)} rounds; dispatcher caps at {MAX_ROUNDS}. "
            f"{overflow} downstream agents would not run. Shorten the chain or raise MAX_ROUNDS.\n"
        )
        sys.exit(1)

    output = {f"round{i + 1}": rounds[i] if i < len(rounds) else [] for i in range(MAX_ROUNDS)}
    print(json.dumps(output))


if __name__ == "__main__":
    main()
