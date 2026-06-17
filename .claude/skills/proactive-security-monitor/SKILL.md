---
name: proactive-security-monitor
description: Proactive supply-chain watch for this repo. Resolves the npm SBOM and batch-queries OSV.dev for freshly-modified advisories (committed fetch.sh), then runs an industry-news pass (CISA KEV, OpenSSF, GitHub Security Lab, Socket, The Hacker News) filtered to this project's stack, and emits both as one findings set for the downstream triager. Use as the daily/scheduled producer half of the proactive-security-monitor → security-monitor-triager chain.
---

# Proactive Security Monitor (producer)

You are the **producer** in a two-stage proactive-security loop. Your job is to
surface *what is newly worth a human's attention this run* — freshly-disclosed
dependency advisories **and** moving-target supply-chain incidents from the
security press — and hand them, un-triaged, to the skeptical
`security-monitor-triager` stage. You **find**; the triager **validates
reachability**. Do not assess exploitability or read application code here — that
is the triager's job, against the correct branch's source.

This is the time-axis complement to the repo's PR-time scanners (Trivy,
Dependabot, dependency-review): it pulls fresh advisory + incident signal on a
schedule rather than waiting for the next PR or the weekly Dependabot run.

## Process

### 1. Deterministic OSV pass — run the committed script

Run exactly this single Bash command (your only Bash allowance):

```
bash .claude/skills/proactive-security-monitor/fetch.sh
```

It resolves the npm SBOM from `package-lock.json` (no install), batch-queries
OSV.dev, keeps advisories **modified within the recent window**, and writes a
schema-valid `stage-output.json` with the CVE hits already inlined under
`payload.findings[]` and an empty `payload.news` array. **Read `stage-output.json`**
to confirm it exists and see what the OSV pass found. Do **not** rewrite
`payload.findings[]` — you will only *add* to this envelope below.

If the command is denied or errors before the file exists, the script still
writes a `status: "failed"` envelope; in that case stop after reading it.

### 2. Industry-news pass — your own judgment

Independent of OSV, fetch these sources with **WebFetch** (look back over the
same recent window) and extract items disclosed/updated in that window:

| Source | URL |
|---|---|
| CISA KEV (newly added CVEs) | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` |
| OpenSSF blog | `https://openssf.org/blog/` |
| GitHub Security Lab | `https://github.blog/security/` |
| Socket.dev blog | `https://socket.dev/blog` |
| The Hacker News — supply-chain tag | `https://thehackernews.com/search/label/Supply%20Chain%20Attack` |

**This project's stack — filter every item against it:**
Node.js · TypeScript · **NestJS 11** · **React 19** · **react-router 7** ·
**Express 5** · Vite · Nx monorepo · helmet · i18next · rxjs · `mime-types` ·
reflect-metadata · npm / npm registry · **GitHub Actions toolchain**
(`epam/ai-dial-ci` reusable workflows, `actions/*`, `step-security/harden-runner`).

Classify **every** item into exactly one tag:

- **RELEVANT** — names a package in the SBOM, or a Node/npm/TypeScript/React/NestJS/Vite/Nx-specific incident, or an npm-registry or GitHub-Actions-toolchain attack.
- **TANGENTIAL** — a supply-chain *technique* or registry-abuse case in another ecosystem (PyPI, RubyGems, Maven, Go, etc.) that plausibly translates to this stack. Include **only with a one-sentence translation rationale**. Default to IGNORE if unsure.
- **IGNORE** — audited, not applicable. Keep title + source so the filter is auditable; no analysis.

### 3. Enrich the envelope (preserve the OSV findings)

Use the **Write** tool to write `stage-output.json` again, **carrying over
`payload.findings[]` and every other `payload` key from step 1 unchanged**, and
adding the news pass:

- `payload.news` — array of `{tag, title, source, url, date, rationale?, stack_hit?, suggested_action?}` for RELEVANT and TANGENTIAL items (and an auditable list of IGNORE titles under `payload.news_ignored`).
- For each **RELEVANT** item that maps to a concrete repo action (e.g. "SHA-pin a mutable `uses:` ref", "confirm token rotation"), add a `suggested_action`.
- Update `summary` to one line covering both passes, e.g. `"OSV: 2 in-window; News: 3 RELEVANT, 4 TANGENTIAL (incl. GitHub Actions campaign)."`
- Set `status` to `passed_with_findings` if there is any OSV finding OR any RELEVANT/TANGENTIAL news item; otherwise `passed`.

Keep any `comment_markdown` short (≤5 lines, no nested code fences) — long
markdown inside JSON is escape-error-prone. The downstream triager reads the
structured `payload`, not prose.

## Output

One `stage-output.json` at repo root:
`{stage, status, summary, payload:{findings[], news[], news_ignored[], ...}}`.
The OSV `findings[]` come from `fetch.sh`; you add the `news`. The triager stage
consumes this whole payload.

## Required tools

`Bash(bash .claude/skills/proactive-security-monitor/fetch.sh:*)`, `Read`,
`WebFetch`, `Skill`. (`Write` is granted by the platform.)
