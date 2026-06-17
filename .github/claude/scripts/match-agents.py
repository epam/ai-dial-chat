#!/usr/bin/env python3
# Discover agents whose manifests match a given GitHub event, validate each
# manifest against the schema, apply kill-switch vars, honor trigger filters
# (branches, labels), validate `permissions:` against the platform-supported
# set, validate the `needs:` DAG (prune agents whose deps are unavailable, fail
# on cycles), and emit the matched agents as a flat list.
#
# Output: {"agents": [...]} — each entry has {name, needs, timeout_minutes,
# concurrency_group}. The dispatcher runs them all in ONE matrix; each agent
# waits for its own `needs:` upstreams inside its job, so there are no rounds.
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

try:
    import jsonschema
except ImportError:
    sys.stderr.write("::error::jsonschema required. Run: pip install jsonschema\n")
    sys.exit(2)

# Disable YAML 1.1 boolean keywords (on/off/yes/no/On/Off/…) at the resolver
# level so an unquoted `on: pull_request` parses with the string key "on"
# instead of the boolean True. true/false remain valid booleans.
for _ch in "yYnNoO":
    if _ch in yaml.SafeLoader.yaml_implicit_resolvers:
        yaml.SafeLoader.yaml_implicit_resolvers[_ch] = [
            (tag, regex)
            for tag, regex in yaml.SafeLoader.yaml_implicit_resolvers[_ch]
            if tag != "tag:yaml.org,2002:bool"
        ]

DEFAULT_TIMEOUT = 15

# Platform-supported permissions. Any manifest requesting permissions OUTSIDE
# this set is rejected; adding a new permission requires raising the bar in
# run-agent.yml + dispatcher (see PLATFORM_REFERENCE.md).
SUPPORTED_PERMISSIONS = {
    "contents": {"read"},
    "pull-requests": {"write"},
    "checks": {"write"},
    "security-events": {"read", "write"},
}


def fail(msg):
    sys.stderr.write(f"::error::{msg}\n")
    sys.exit(1)


def warn(msg):
    sys.stderr.write(f"::warning::{msg}\n")


def notice(msg):
    sys.stderr.write(f"::notice::{msg}\n")


def matches_trigger(triggers, event):
    """Return (matched, filters) — filters from the matching trigger, if any."""
    for t in triggers or []:
        if isinstance(t, str) and t == event:
            return True, {}
        if isinstance(t, dict) and t.get("on") == event:
            return True, t.get("filters") or {}
    return False, {}


def passes_filters(filters, event_ctx):
    """Apply branches + labels filters. `paths` deferred to v0.3."""
    if not filters:
        return True

    pr = event_ctx.get("pull_request") or {}
    branches = filters.get("branches") or []
    if branches:
        target = (pr.get("base") or {}).get("ref", "")
        if target and target not in branches:
            return False

    required_labels = filters.get("labels") or []
    if required_labels:
        pr_labels = {lbl.get("name") for lbl in pr.get("labels") or []}
        if not all(req in pr_labels for req in required_labels):
            return False

    return True


def kill_switch_var(name):
    return "STAGE_" + name.upper().replace("-", "_") + "_ENABLED"


def validate_permissions(name, perms):
    """Fail if any declared permission exceeds the platform's supported set."""
    if not perms:
        return
    for scope, level in perms.items():
        allowed = SUPPORTED_PERMISSIONS.get(scope)
        if allowed is None:
            fail(
                f"agent {name} declares unsupported permission '{scope}'. "
                f"Platform supports: {sorted(SUPPORTED_PERMISSIONS)}. "
                f"See .github/claude/PLATFORM_REFERENCE.md → permission tiers."
            )
        if level not in allowed:
            fail(
                f"agent {name} declares '{scope}: {level}' but platform supports "
                f"only '{scope}: {sorted(allowed)}'."
            )


def derive_concurrency_group(name, ref):
    return f"dispatch-pr-{name}-{ref}"


def discover_agents(root, event, event_ctx, vars_dict, schema):
    matched = {}
    for path in sorted(glob.glob(f"{root}/agents/*/agent.yml")):
        if os.path.basename(os.path.dirname(path)).startswith("_"):
            continue
        try:
            with open(path) as f:
                manifest = yaml.safe_load(f) or {}
        except Exception as e:
            fail(f"could not load {path}: {e}")

        # Schema validation — fail loudly with the path.
        try:
            jsonschema.validate(instance=manifest, schema=schema)
        except jsonschema.ValidationError as e:
            fail(f"manifest schema violation in {path}: {e.message} (at {list(e.absolute_path)})")

        name = manifest["name"]

        matched_event, filters = matches_trigger(manifest.get("triggers"), event)
        if not matched_event:
            continue
        if not passes_filters(filters, event_ctx):
            notice(f"agent {name} skipped by trigger filters (branches/labels mismatch)")
            continue

        ks_var = manifest.get("kill_switch_var") or kill_switch_var(name)
        if vars_dict.get(ks_var) == "false":
            notice(f"agent {name} disabled via {ks_var}=false")
            continue

        validate_permissions(name, manifest.get("permissions"))

        ref = os.environ.get("GITHUB_REF", "")
        concurrency = manifest.get("concurrency") or {}
        entry = {
            "name": name,
            "needs": manifest.get("needs") or [],
            "timeout_minutes": int(manifest.get("timeout_minutes") or DEFAULT_TIMEOUT),
            "concurrency_group": concurrency.get("group") or derive_concurrency_group(name, ref),
        }
        matched[name] = entry
    return matched


def topo_sort_rounds(agents):
    available = set(agents)

    pruned = {}
    for name, a in agents.items():
        missing = set(a["needs"]) - available
        if missing:
            warn(f"skipping {name}; needed agents not available: {sorted(missing)}")
            continue
        pruned[name] = a

    remaining = dict(pruned)
    processed = set()
    rounds = []
    while remaining:
        ready = [a for a in remaining.values() if not (set(a["needs"]) - processed)]
        if not ready:
            fail(f"Cycle detected in agent `needs:` deps: {sorted(remaining)}")
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
    p.add_argument("--event-context", help="Path to JSON dump of github.event (for filter evaluation)")
    p.add_argument("--root", default=".", help="Repo root (default: cwd)")
    args = p.parse_args()

    schema_path = os.path.join(args.root, ".github/claude/schemas/agent-manifest.schema.json")
    try:
        with open(schema_path) as f:
            schema = json.load(f)
    except FileNotFoundError:
        fail(f"manifest schema not found: {schema_path}")

    vars_dict = {}
    if args.vars and os.path.exists(args.vars):
        with open(args.vars) as f:
            vars_dict = json.load(f) or {}

    event_ctx = {}
    if args.event_context and os.path.exists(args.event_context):
        with open(args.event_context) as f:
            event_ctx = json.load(f) or {}

    agents = discover_agents(args.root, args.event, event_ctx, vars_dict, schema)
    # topo_sort_rounds still runs — for cycle detection and for pruning agents
    # whose `needs:` are unavailable — but we flatten its output: the dispatcher
    # no longer uses rounds. Every matched agent runs in one matrix and waits for
    # its own `needs:` upstream jobs, so per-edge scheduling replaces round
    # barriers (a dependent starts as soon as ITS upstream is done).
    rounds = topo_sort_rounds(agents)
    flat = [a for r in rounds for a in r]
    print(json.dumps({"agents": flat}))


if __name__ == "__main__":
    main()
