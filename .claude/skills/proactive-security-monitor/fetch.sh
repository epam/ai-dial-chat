#!/usr/bin/env bash
# proactive-security-monitor fetch script (deterministic OSV pass).
#
# Resolves this repo's dependency SBOM from package-lock.json (NO install — we
# parse the committed lockfile directly, so nothing from the tree is executed;
# this keeps the producer safe to run on the sandbox pull_request trigger per
# ADR-0005 P-2), batch-queries OSV.dev for advisories touching those packages,
# keeps only advisories MODIFIED within a recent window (the "what's new since
# last run" signal), fetches per-advisory detail, and writes the SDLC stage
# envelope (stage-output.json) at the repo root with the CVE hits inlined under
# payload.findings[].
#
# WHY INLINE THE FINDINGS: the platform uploads ONLY stage-output.json as the
# upstream artifact, so any sidecar files do NOT travel to the downstream
# triager. The consumable findings therefore live inline under
# payload.findings[] (mirroring snyk-jira-ingest's payload.issues).
#
# WHY A COMMITTED SCRIPT: the agent-wrapper forbids pipes / redirects / shell
# variable expansion in commands Claude types into its Bash tool, so the model
# cannot type a curl|python pipeline. This committed, reviewed script does the
# whole deterministic pass; the agent only ever invokes
# `bash .claude/skills/proactive-security-monitor/fetch.sh` (literal, no
# expansion), which is its entire Bash allowlist. The model's own job (the
# industry-news WebFetch pass) is layered on top in SKILL.md and ENRICHES this
# envelope; it must preserve payload.findings[] verbatim.
#
# The script always writes a schema-valid stage-output.json and exits 0, so the
# platform renders/handles a result even when the network or lockfile fails.
set -uo pipefail

export STAGE="proactive-security-monitor"
export OUT="stage-output.json"
export LOCK="${PSM_LOCKFILE:-package-lock.json}"
# Advisory recency window (days). The value proposition is "faster on the time
# axis" than weekly Dependabot / next-PR Trivy, so the default is tight; widen
# via the PSM_WINDOW_DAYS Actions Variable for a first/catch-up run.
export WINDOW_DAYS="${PSM_WINDOW_DAYS:-7}"
# Hard cap on inlined findings so a noisy window can't blow the triager's turn
# budget. 0 = no cap. Tune via the PSM_MAX_FINDINGS Actions Variable.
export MAX_FINDINGS="${PSM_MAX_FINDINGS:-50}"

python3 - <<'PY'
import json, os, sys, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

STAGE = os.environ["STAGE"]
OUT   = os.environ["OUT"]
LOCK  = os.environ["LOCK"]
WINDOW_DAYS  = int(os.environ.get("WINDOW_DAYS", "7") or "7")
MAX_FINDINGS = int(os.environ.get("MAX_FINDINGS", "50") or "0")

OSV_BATCH = "https://api.osv.dev/v1/querybatch"
OSV_VULN  = "https://api.osv.dev/v1/vulns/"
cutoff = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)

def write(doc):
    doc["summary"] = doc.get("summary", "")[:280]
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)

def fail(summary):
    write({"stage": STAGE, "status": "failed", "summary": summary,
           "payload": {"scanner": "osv", "ecosystem": "npm",
                       "window_days": WINDOW_DAYS, "sbom_count": 0,
                       "findings": [], "news": []}})
    print(summary)
    sys.exit(0)

# --- 1. Resolve SBOM from the committed lockfile (no install) ---------------
try:
    with open(LOCK) as f:
        lock = json.load(f)
except FileNotFoundError:
    fail(f"{LOCK} not found at repo root; cannot resolve the npm SBOM.")
except json.JSONDecodeError as e:
    fail(f"{LOCK} is not valid JSON: {e}")

# lockfileVersion 2/3: every installed third-party package is a `packages` entry
# keyed by its node_modules path. Workspace packages (no node_modules/ segment)
# and link entries are skipped. The real package name is the substring after the
# LAST `node_modules/` (handles scoped + nested deps).
pkgs = {}
for path, meta in (lock.get("packages") or {}).items():
    if "node_modules/" not in path:
        continue                       # workspace root / local workspace package
    if meta.get("link"):
        continue                       # symlink to a local workspace package
    version = meta.get("version")
    if not version:
        continue
    name = path.split("node_modules/")[-1]
    pkgs[(name, version)] = True       # dedupe by (name, version)

sbom = [{"name": n, "version": v} for (n, v) in pkgs]
if not sbom:
    fail(f"No third-party npm packages resolved from {LOCK}.")

def post_json(url, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def get_json(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)

# --- 2. Batch-query OSV, chunked (OSV caps batch size) ----------------------
hits = {}     # osv_id -> (name, version)
try:
    CHUNK = 800
    for i in range(0, len(sbom), CHUNK):
        chunk = sbom[i:i + CHUNK]
        body = {"queries": [
            {"package": {"name": p["name"], "ecosystem": "npm"},
             "version": p["version"]} for p in chunk]}
        resp = post_json(OSV_BATCH, body)
        for p, result in zip(chunk, resp.get("results", [])):
            for v in (result.get("vulns") or []):
                vid = v.get("id")
                mod = v.get("modified", "")
                if not vid:
                    continue
                # Filter on `modified` BEFORE fetching detail (cheap window cut).
                try:
                    mdt = datetime.fromisoformat(mod.replace("Z", "+00:00"))
                except ValueError:
                    mdt = None
                if mdt is None or mdt >= cutoff:
                    hits.setdefault(vid, (p["name"], p["version"]))
except urllib.error.URLError as e:
    fail(f"OSV batch query failed (network/endpoint): {e}")

# --- 3. Fetch detail for in-window hits; build findings ---------------------
def severity_label(detail):
    # Prefer GHSA's database_specific severity label; fall back to a coarse
    # CVSS bucket; else unknown (kept — the triager calibrates authoritatively).
    ds = (detail.get("database_specific") or {}).get("severity")
    if ds:
        return ds.upper()
    for s in (detail.get("severity") or []):
        sc = s.get("score", "")
        # Numeric base score if OSV gave one directly.
        try:
            n = float(sc)
            return ("CRITICAL" if n >= 9 else "HIGH" if n >= 7
                    else "MEDIUM" if n >= 4 else "LOW")
        except ValueError:
            pass
    return "UNKNOWN"

LABEL_TO_SEV = {"CRITICAL": "critical", "HIGH": "high", "MODERATE": "medium",
                "MEDIUM": "medium", "LOW": "low", "UNKNOWN": "medium"}

findings = []
for vid, (name, version) in hits.items():
    try:
        detail = get_json(OSV_VULN + vid)
    except urllib.error.URLError:
        detail = {"id": vid, "summary": "(advisory detail fetch failed)"}
    label = severity_label(detail)
    summary = (detail.get("summary") or detail.get("details") or "")[:300]
    text_blob = (summary + " " + json.dumps(detail.get("database_specific") or {})).lower()
    supply_chain = any(k in text_blob for k in
                       ("malicious", "supply chain", "supply-chain", "compromis", "typosquat"))
    # Drop only clearly-LOW non-supply-chain advisories; keep the rest and let
    # the triager calibrate severity against real reachability.
    if label == "LOW" and not supply_chain:
        continue
    aliases = detail.get("aliases") or []
    refs = [r.get("url") for r in (detail.get("references") or []) if r.get("url")]
    findings.append({
        "severity": LABEL_TO_SEV.get(label, "medium"),
        "message": f"{vid} ({', '.join(aliases) or 'no-CVE'}) affects {name}@{version}: {summary}",
        "osv_id": vid,
        "aliases": aliases,
        "package": name,
        "version": version,
        "osv_severity_label": label,
        "supply_chain": supply_chain,
        "advisory_url": (f"https://osv.dev/vulnerability/{vid}"),
        "references": refs[:5],
        "modified": detail.get("modified", ""),
        "affected": detail.get("affected", []),   # ranges — triager re-verifies version match
    })

# Stable order: supply-chain first, then by severity, then id.
sev_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
findings.sort(key=lambda f: (not f["supply_chain"], sev_rank.get(f["severity"], 9), f["osv_id"]))
total = len(findings)
deferred = 0
if MAX_FINDINGS > 0 and total > MAX_FINDINGS:
    deferred = total - MAX_FINDINGS
    findings = findings[:MAX_FINDINGS]

status = "passed_with_findings" if findings else "passed"
if total:
    cap_note = f" (cap {MAX_FINDINGS}, {deferred} deferred)" if deferred else ""
    summary = (f"OSV: {total} in-window advisory(ies) over {len(sbom)} npm packages "
               f"(last {WINDOW_DAYS}d){cap_note}. News pass pending (model step).")
else:
    summary = (f"OSV: 0 advisories modified in last {WINDOW_DAYS}d across {len(sbom)} "
               f"npm packages. News pass pending (model step).")

write({
    "stage": STAGE, "status": status, "summary": summary,
    "payload": {
        "scanner": "osv", "ecosystem": "npm",
        "window_days": WINDOW_DAYS, "sbom_count": len(sbom),
        "osv_total": total, "osv_deferred": deferred,
        "findings": findings,
        # The model's industry-news WebFetch pass (SKILL.md) fills this in and
        # MUST preserve findings[] above. Empty array = news pass not yet run.
        "news": [],
    },
})
print(f"OSV pass: {len(sbom)} npm packages, {total} in-window advisory(ies), "
      f"inlined {len(findings)} into {OUT}.")
PY
