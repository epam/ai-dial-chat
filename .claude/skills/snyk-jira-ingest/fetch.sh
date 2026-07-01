#!/usr/bin/env bash
# snyk-jira-ingest fetch script.
#
# Pulls real Snyk SAST findings from EPAM Jira (Data Center) via the
# search-export API, parses the export into structured issues, and writes
# the SDLC stage envelope (stage-output.json) at the repo root. The raw
# export is also kept at jira-export.xml for local debugging.
#
# WHY INLINE THE ISSUES: the platform uploads ONLY stage-output.json as the
# upstream artifact, so jira-export.xml does NOT travel to a downstream
# agent. The consumable findings therefore live inline under
# `payload.issues` (mirroring how snyk-scan-stub inlines `payload.sarif`).
#
# WHY A COMMITTED SCRIPT: the agent-wrapper forbids shell variable
# expansion / pipes / redirections in commands Claude types into its Bash
# tool. So the agent cannot type `curl -H "...: Bearer ${JIRA_PAT}"`. This
# script — committed and reviewed — reads JIRA_PAT from the environment
# (injected by run-agent.yml from the manifest's declared `secrets:`), so
# the token is NEVER typed into, or seen by, the model. The agent only ever
# invokes `bash .claude/skills/snyk-jira-ingest/fetch.sh` (literal, no
# expansion) and that single command is the agent's entire Bash allowlist.
#
# The script always writes a schema-valid stage-output.json and exits 0, so
# the platform renders a sticky comment even on failure (status: failed).
set -uo pipefail

export STAGE="snyk-jira-ingest"
export BASE="${JIRA_BASE_URL:-https://jiraeu.epam.com}"
export FILTER_ID="${JIRA_FILTER_ID:-189402}"
export JQL="${JIRA_JQL:-filter = ${FILTER_ID} AND status not in (Closed, \"Security Review\") ORDER BY priority}"
export MAX="${JIRA_MAX:-1000}"
export XML="jira-export.xml"
export OUT="stage-output.json"

# Which repo this run triages. The Jira dashboard spans ALL DIAL repos and the
# tickets carry no per-repo label; the only signal is the repo-prefixed file
# path in each issue's "Location:" section (e.g. `ai-dial-chat/apps/chat/...`).
# We keep only issues whose body references `<REPO_NAME>/...` and drop the rest
# BEFORE triage, so the expensive triage agent never sees other repos' findings.
# Derive from the manifest override, else the GH repo name, else the cwd name.
REPO_NAME="${JIRA_REPO_NAME:-}"
if [ -z "$REPO_NAME" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
  REPO_NAME="${GITHUB_REPOSITORY##*/}"
fi
[ -z "$REPO_NAME" ] && REPO_NAME="$(basename "$PWD")"
export REPO_NAME

# Emit a failure envelope (no issues) and stop. Args: <status> <summary>.
emit_failure() {
  STATUS="$1" SUMMARY="$2" python3 - <<'PY'
import json, os
fid = os.environ["FILTER_ID"]
doc = {
    "stage": os.environ["STAGE"],
    "status": os.environ["STATUS"],
    "summary": os.environ["SUMMARY"][:280],
    "payload": {
        "scanner": "snyk-code", "source": "jira",
        "report_format": "jira-searchrequest-xml",
        "report_location": os.environ["XML"],
        "jira": {
            "base_url": os.environ["BASE"],
            "filter_id": int(fid) if fid.isdigit() else fid,
            "jql": os.environ["JQL"], "repo_name": os.environ["REPO_NAME"],
            "fetched_count": 0, "matched_count": 0, "dropped_count": 0,
            "analyzed_count": 0, "max_findings": int(os.environ.get("JIRA_MAX_FINDINGS", "10") or "0"),
        },
        "issues": [], "deferred": [], "dropped": [],
    },
}
with open(os.environ["OUT"], "w") as f:
    json.dump(doc, f, indent=2)
PY
}

if [ -z "${JIRA_PAT:-}" ]; then
  emit_failure "failed" \
    "JIRA_PAT not set; cannot authenticate to Jira. Declare it in the manifest \`secrets:\` and add the repo/org Actions secret."
  exit 0
fi

# -G + --data-urlencode encodes the JQL; -o writes the body; -w captures the
# HTTP status. Same endpoint the Jira UI "Export -> XML" drives.
http=$(curl -sS -G \
  -H "Authorization: Bearer ${JIRA_PAT}" \
  -H "Accept: application/xml" \
  --data-urlencode "jqlQuery=${JQL}" \
  --data-urlencode "tempMax=${MAX}" \
  -o "$XML" -w '%{http_code}' \
  "${BASE%/}/sr/jira.issueviews:searchrequest-xml/temp/SearchRequest.xml") || http="000"

if [ "$http" != "200" ]; then
  emit_failure "failed" \
    "Jira export returned HTTP ${http} (expected 200). Check JIRA_PAT validity and that ${BASE} is reachable from the runner."
  exit 0
fi

# Parse the export, filter to THIS repo by the repo-prefixed Location path,
# and inline the kept issues so the artifact is self-contained for downstream
# triage. Description and environment are preserved raw — they carry the SAST
# file/line/issue-hash that triage extracts.
python3 - <<'PY'
import json, os, re
import xml.etree.ElementTree as ET

def text(el, tag):
    e = el.find(tag)
    return (e.text or "").strip() if e is not None and e.text else ""

fid = os.environ["FILTER_ID"]
repo = os.environ["REPO_NAME"]

def write(doc):
    with open(os.environ["OUT"], "w") as f:
        json.dump(doc, f, indent=2)

try:
    root = ET.parse(os.environ["XML"]).getroot()
except ET.ParseError as e:
    write({
        "stage": os.environ["STAGE"], "status": "failed",
        "summary": f"Jira export was not parseable XML: {e}"[:280],
        "payload": {"scanner": "snyk-code", "source": "jira",
                    "report_format": "jira-searchrequest-xml",
                    "report_location": os.environ["XML"],
                    "jira": {"base_url": os.environ["BASE"], "jql": os.environ["JQL"],
                             "repo_name": repo, "fetched_count": 0,
                             "matched_count": 0, "dropped_count": 0}, "issues": [], "dropped": []},
    })
    raise SystemExit(0)

# Boundary-anchored repo-prefix matcher: captures `<repo>/<path>` tokens in the
# issue body. The leading (?:^|[^\w-]) stops `ai-dial-chat` from matching inside
# `x-ai-dial-chat/` or `ai-dial-chat-themes/` (the char after the name must be
# `/`). The path char class excludes `<` so it stops at the surrounding HTML.
prefix_re = re.compile(r"(?:^|[^\w-])" + re.escape(repo) + r"/([\w./-]+)")

kept, dropped = [], []
for it in root.findall(".//item"):
    issue = {
        "key": text(it, "key"),
        "title": text(it, "title"),
        "link": text(it, "link"),
        "summary": text(it, "summary"),
        "priority": text(it, "priority"),
        "status": text(it, "status"),
        "resolution": text(it, "resolution"),
        "labels": [l.text.strip() for l in it.findall("./labels/label") if l.text and l.text.strip()],
        "created": text(it, "created"),
        "updated": text(it, "updated"),
        "description": text(it, "description"),
        "environment": text(it, "environment"),
    }
    blob = "\n".join((issue["title"], issue["description"], issue["environment"]))
    files = sorted(set(prefix_re.findall(blob)))   # repo-relative paths (prefix stripped)
    if files:
        issue["files"] = files                      # normalized for triage's file lookups
        kept.append(issue)
    else:
        dropped.append(issue["key"])

fetched, matched, ndropped = len(kept) + len(dropped), len(kept), len(dropped)

# Cap on how many repo-matched findings we hand to triage. Default 10 keeps
# triage within its turn budget (all ~34 real findings overran). Set
# JIRA_MAX_FINDINGS=0 for no cap (analyze all), or =N for the top-N priority
# findings (the JQL is priority-ordered). Deferred keys (beyond the cap) are
# recorded so the backlog stays visible.
cap = int(os.environ.get("JIRA_MAX_FINDINGS", "10") or "0")
analyzed_issues = kept[:cap] if cap > 0 else kept
deferred = [i["key"] for i in kept[cap:]] if cap > 0 else []
analyzed = len(analyzed_issues)

if dropped:
    print(f"Dropped {ndropped} cross-repo issue(s) (no '{repo}/' path): {', '.join(dropped)}")
if deferred:
    print(f"Deferred {len(deferred)} matched issue(s) beyond cap {cap}: {', '.join(deferred)}")

status = "passed_with_findings" if analyzed else "passed"
if matched:
    cap_note = f" (cap {cap}, {len(deferred)} deferred)" if deferred else ""
    summary = f"{matched} {repo} finding(s); analyzing {analyzed}{cap_note}; {ndropped} cross-repo dropped."
else:
    summary = f"Pulled {fetched} from filter {fid}; 0 relate to {repo} ({ndropped} cross-repo dropped)."

write({
    "stage": os.environ["STAGE"], "status": status, "summary": summary[:280],
    "payload": {
        "scanner": "snyk-code", "source": "jira",
        "report_format": "jira-searchrequest-xml",
        "report_location": os.environ["XML"],
        "jira": {
            "base_url": os.environ["BASE"],
            "filter_id": int(fid) if fid.isdigit() else fid,
            "jql": os.environ["JQL"], "repo_name": repo,
            "fetched_count": fetched, "matched_count": matched, "dropped_count": ndropped,
            "analyzed_count": analyzed, "max_findings": cap,
        },
        "issues": analyzed_issues,
        "deferred": deferred,
        "dropped": dropped,
    },
})
print(f"Analyzing {analyzed}/{matched} matched ({fetched} fetched) for {repo} into {os.environ['OUT']}")
PY