---
name: chat-release-notes
description: Use when the user asks to enhance, refine, polish, or "look at" the release notes for a tag — typically a fresh CI-generated pre-release (e.g. `0.45.0-rc.55`) or a stable cut. Reads the auto-generated notes off the GitHub release, classifies and rewrites each bullet in this project's editorial voice, builds the `Deployment Changes` section from `apps/chat/README.md` / PR bodies / source, and saves a draft to `claude/release-notes/`. Never edits GitHub directly.
allowed-tools: Read Grep Glob LSP Bash(gh release view:*) Bash(gh release list:*) Bash(gh pr view:*) Bash(gh pr list:*) Bash(gh pr diff:*) Bash(git log:*) Bash(git show:*) Bash(git diff:*) Bash(git tag:*) Bash(git rev-parse:*) Bash(date:*) Write(claude/release-notes/*) Bash(mkdir -p claude/release-notes)
argument-hint: "[tag]"
arguments: tag
model: opus
effort: xhigh
context: fork
agent: general-purpose
---

# DIAL Chat release-notes enhancer

The CI publishes a release for every tag with bullets that are just the PR titles. Those bullets carry a lot of dirt — conventional-commit prefixes (`feat(chat):`, `fix(chat):`, `feat(chat-e2e):`, `fix(overlay):`), branch-style phrasing inherited from the PR title, duplicate entries when the same issue was patched twice (e.g. two `(Issue #4696) (#6135)` / `(#6430)` bullets in `0.45.0`), `Revert "..."` lines that were never reconciled with their original entry, and a `## Other` section that mixes maintainer-relevant bumps with pure tooling churn. The releases visible at `https://github.com/epam/ai-dial-chat/releases` from `0.43.x` through `0.45.1` are what those raw notes look like after a human editorial pass. This skill reproduces that pass.

You are running in a forked, isolated context. Read and research freely — only the final summary you return reaches the main conversation. All file writes happen in this fork; the draft lands at `claude/release-notes/<tag>-draft.md`.

## When to use

- "Enhance the release notes for `0.45.0-rc.55`"
- "Look at the latest pre-release notes and refine them"
- "Help me adjust release notes for the current rc"
- "The CI just published `<tag>`, make it readable"

Do **not** trigger on requests like "what changed in 0.45.0?" — that is a recall question, not a notes-editing task.

## Inputs

`tag` = `$tag` — the GitHub release tag to enhance (e.g. `0.45.0-rc.55`, `0.46.0`). If empty, pick the most recent tag from `gh release list --limit 5` and confirm with the user before editing.

## Workflow

### 1. Resolve target and reference styles

1. `gh release view <tag> --json body,name,tagName` — capture the raw CI notes.
2. `gh release list --limit 10` — locate the previous tag of the same kind (last stable for a stable release, the predecessor `rc` for a delta `rc.N+1`).
3. `gh release view <prev-stable-tag> --json body` and `gh release view <prev-rc-tag> --json body` (when relevant) — these are the style anchors. The user has repeatedly insisted **"keep the same format as the latest stable release"** and **"your notes are too verbose"** — match the terseness of those notes, not your own instincts. One line per bullet.
4. `git tag --list | sort -V` + `git log <prev-tag>..<tag> --oneline` — full commit list for the range, so you can spot hotfix commits the CI dropped because they had no PR.

### 2. Pull source context for each bullet

For every bullet in the raw notes:

1. Parse out the trailing `#<issue> (#<PR>)` or `(#<PR>)`. If only a PR number is present, that's the canonical reference; if both, keep `#<issue> (#<PR>)` order.
2. `gh pr view <PR> --json title,body,labels` — read the PR body, not just the title. The body is where the *why* and the *what-it-replaces* live; the title is usually too compressed.
3. For bullets without a PR number, find the commit with `git log <prev-tag>..<tag> --oneline | grep -i <keywords>` and `git show <hash>` — usually a hotfix commit that should fold into a related entry.
4. If a PR body references a doc under `docs/`, `libs/overlay/README.md`, or `docs/THEME-CUSTOMIZATION.md`, skim it for the headline framing.

### 3. Cross-check `apps/chat/README.md` / source for deployment changes

The `Deployment Changes` section is built from primary sources, not PR titles:

- `git diff <prev-tag>..<tag> -- apps/chat/README.md` — env-var additions/removals/renames.
- For any env var that lands in the section, verify the **canonical name** by `Grep`-ing the codebase for `process.env.VAR_NAME` in `apps/chat/src` and `libs`. Past releases have caught README typos this way — the README said one thing, the code said another, code wins.
- Confirm defaults by reading the `process.env.VAR_NAME ?? '<default>'` clause at the access site.

### 4. Classify each bullet (move things between sections, drop the noise)

The raw notes' `## Features` / `## Fixes` / `## Other` partition is unreliable because CI keys it off the conventional-commit prefix in the PR title. Reclassify by the change's actual user impact:

| Where CI put it | Where it belongs | Rule |
|---|---|---|
| `Other` starting with `feat(...)` | `Features` | A feat that lost its slot to a scope prefix. |
| `Other` starting with `fix(...)` | `Fixes` | Same, for fix. |
| `Features` / `Fixes` for a pre-release-only regression | `Fixes` with note "(affects pre-release users of \<feature\> only)" | Don't surface a transient bug as a feature. |
| `Other` for a security CVE bump | `Fixes` | Security items are user-relevant. |
| Multiple PRs / hotfix commits on one feature | one folded entry under the appropriate section | Cite the commit hashes or PR numbers in parens. |

**Drop these from the notes entirely** — they have no consumer-visible effect:

- All `feat(chat-e2e):` / `fix(chat-e2e):` / `chore(chat-e2e):` items unless the PR also touches `apps/chat/src` in a behavior-changing way (verify via `gh pr view --json files`).
- Pure refactors / formatting / lint / tsconfig / `nx.json` / `project.json` / Nx project-graph shuffles (`chore(chat): refactor utils`, `chore: bump nx`).
- CI / workflow changes (`.github/workflows/**`) **unless** a maintainer needs to know — then keep under `Other` with a one-line rationale.
- Pure dependency bumps with no CVE / no behavior delta (`chore: bump types/node`).
- `Merge remote-tracking branch …` commits.
- Claude Code agent setup / docs / skill scaffolding.

**Keep in `Other`** — items maintainers, embedders, or themers care about even if they're not features:

- Security-adjacent dependency bumps (`bump axios`, `bump next`).
- `dial-ui-kit` (visible default styles).
- Forwarded-headers / auth-handling checks.
- Issue templates, contributor docs (visible to contributors).

If you find yourself unsure whether to drop a bullet, ask: *would a customer reading these notes care that this happened?* If no, drop it.

### 5. Rewrite each kept bullet

The raw form is `* <conventional-prefix(scope)>: <PR title> (Issue #<N>) (#<PR>)`. Rewrite to:

```
* <Active-voice description of what changed> — <brief why-it-matters or what-it-replaces> (Issue #<N>) (#<PR>)
```

Rules in order of importance:

1. **One line per bullet.** No multi-paragraph descriptions. The user has explicitly flagged "too verbose" in prior runs. If you need more detail, save it to the companion editorial-notes file (see §8), not the main draft.
2. **Drop the conventional prefix** (`feat(chat):`, `fix(chat):`, `feat(overlay):`, `fix(i18n):`). Replace with prose.
3. **Drop branch-style phrasing.** `add prop to hide item name in path` → `Hide the item name segment in breadcrumb paths via a new prop`. The PR title is the prompt, not the output.
4. **Use a `—` em-dash for the "why" clause**, not a hyphen or colon — that's the consistent house style across `0.43.x`–`0.45.x`.
5. **Backticks for code identifiers**: env vars (`THEMES_CONFIG_HOST`, `ENABLED_FEATURES`), feature-flag keys (`conversations-publishing`), file paths, prop names, type names, overlay-API method names.
6. **Preserve issue + PR refs at the end** in `(Issue #<N>) (#<PR>)` parenthesised form, or `(#<PR>)` when there is no issue. Don't strip them — these notes ship as the GitHub release body where the numbers auto-link.
7. **Prefix with `[Preview]`** for preview-gated features.
8. **Flag regressions explicitly**: `(regression fix)` for items restoring previously-working behavior.
9. **Quote CVE IDs verbatim** for security upgrades: `Upgrade axios to 1.7.9 to address CVE-2024-39338`.

#### Example transformations

Each pair is `raw CI` → `enhanced`. Backticks in the enhanced form denote code identifiers in the actual output.

```
# Dropping `feat(chat):`, naming the concrete prop and surface:
- * feat(chat): add prop to hide item name in path (Issue #6210) (#6292)
+ * Hide the item name segment in breadcrumb paths via a new `hideItemNameInPath` prop on path-rendering components (Issue #6210) (#6292)

# Removing `fix(chat):` and naming the precise gap, marking regression:
- * fix(chat): fix quick app review flow when orchestrator does not support temperature (Issue #6637) (#6688)
+ * Fix Quick App review flow when the orchestrator deployment does not advertise `temperature` support (regression fix) (Issue #6637) (#6688)

# Folding two PRs that patched the same issue into one bullet:
- * fix(chat): publication request scrolling (Issue #4696) (#6135)
- * fix(chat): publication request scrolling follow-up (Issue #4696) (#6430)
+ * Fix scrolling inside the publication-request panel when the list overflows the viewport (Issue #4696) (#6135, #6430)

# Reverts whose original is in the same range — drop both:
- * feat(chat): introduce experimental thread-grouping (#6401)
- * Revert "feat(chat): introduce experimental thread-grouping" (#6488)
+ (drop both — net zero in the range)

# Revert whose original shipped earlier — keep, rephrase as roll-back:
- * Revert "feat(chat): aggressive prefetch of conversation history" (#6404)
+ * Roll back the aggressive prefetch of conversation history shipped in `0.44.0` — restores prior load-on-demand behavior (#6404)

# Dropping `feat(chat-e2e):` entirely (test-only):
- * feat(chat-e2e): updated tests with expand/collapse attachment feature (#6541)
+ (drop)

# Reclassified (raw had it in Other because of `feat(overlay):` prefix), prefixed [Overlay]:
- * feat(overlay): expose subscribeToEvents for prompt-selection (#6364)
+ * [Overlay] Expose `subscribeToEvents('promptSelected', …)` on `ChatOverlay` for embedders to react to in-chat prompt selection (#6364)

# Security bump → Fixes, phrased as user impact:
- * chore: bump axios to 1.7.9 (#6512)
+ * Upgrade `axios` to `1.7.9` to address CVE-2024-39338 (server-side request forgery in absolute-URL handling) (#6512)

# Theme-contract change → Other with [Theme] prefix:
- * chore(chat): bump dial-ui-kit to 0.20.0 (#6337)
+ * [Theme] Bump `@epam/ai-dial-shared` UI-kit to `0.20.0` — default button radii and disabled-state opacities shift; downstream themes overriding `--button-*` tokens may need a visual review (#6337)

# Folded orphan hotfix commits into a related fix entry:
- * publication URL escaping        (orphan commit, no PR)
- * fix tests                        (orphan commit, no PR)
+ * Escape `%` and `#` in publication URLs before they reach the router — fixes 404s on conversations with reserved characters in the title (`a1b2c3d`, `e4f5a6b`)
```

### 6. Build the `Deployment Changes` section

Add this section **only** when the range introduces at least one env-var, behavioral, or schema change. Pick subsections — include only the ones with entries:

```markdown
## Deployment Changes

### New environment variables
<table: Variable | Default | Description>

### Deprecated environment variables
> [!CAUTION]
> Still works, but will be removed in future versions.
<table: Variable | Replacement | Description>

### Removed environment variables
<table: Variable | Reason>

### Behavioral changes
> [!NOTE]
> <one-line explaining the behavioral shift, e.g. preview→GA graduations>
- **<Feature>** — <field / module> (#<PR>)
```

#### Which subsection: telling Behavioral and Schema deprecations apart

These two look adjacent but answer different operator questions:

- **Behavioral changes** — *"How does the deployed Chat app behave differently at runtime once I redeploy this image?"* Default flag flips (e.g. a feature gated by `ENABLED_FEATURES` becoming default-on), prefetch policy changes, default theme shifts, default model selection, error-handling shifts. Operator does nothing; the change is automatic on upgrade. Uses `> [!NOTE]`.
- **Schema deprecations** — *"What keys in my settings JSON / overlay options / `ENABLED_FEATURES_DATA` payload are being renamed?"* Inside-repo schema evolution where the parser still accepts legacy keys via aliases. Uses `> [!CAUTION]` and a table.

If a change requires the operator to touch a config file outside this repo (DIAL Core's `aidial.config.json`, helm `values.yaml`, an external IDP config, an `ai-dial-chat-themes` deployment), it belongs in **DIAL Configuration changes** with a concrete remove/add migration list, never in Behavioral changes.

**Crucial — what does *not* belong here**: per-conversation settings, per-app overlay options the embedder passes at runtime, in-chat user preferences. Those changes belong in the **Features** bullet body where they're introduced. `Deployment Changes` is for operator-facing concerns: env vars, default-on/off behavioral shifts, schema-level deprecations.

For the env-var tables, the description column comes from `apps/chat/README.md` when the row exists there; otherwise from the `process.env.VAR` access site's surrounding code. Cite default values verbatim from the README's "Default values" column or the `?? '<default>'` clause in source.

### 7. Pre-release / delta handling

If the target is `<X.Y.Z>-rc.N` with `N ≥ 1`:

- The release covers only what changed since the previous rc — do **not** consolidate or rewrite the predecessor's notes. Each pre-release tag has its own GitHub release page; the consolidation happens at the stable cut. (Note: `ai-dial-chat` rc trains can be very long — `0.45.0` shipped at `rc.55` — so resist the urge to "summarise the whole train" on rc.N.)
- Drop sections that have no entries in the delta (e.g. no `Deployment Changes` if no env vars or behavioral shifts landed in this rc).
- Do **not** prepend a "Delta since <prev-rc>" pointer at the top. The CI doesn't emit one, the previously-shipped rc notes don't carry one, and the `-rc.N` version suffix already signals what the release is. Adding a header just creates editorial noise the user has to clean up.

### 8. Save the draft (and optional editorial companion)

Create `claude/release-notes/` if missing, then write:

- **`claude/release-notes/<tag>-draft.md`** — the final notes, ready to paste into the GitHub release body. No preamble, no commentary — just the headings and bullets.
- **`claude/release-notes/<tag>-editorial-notes.md`** *(optional)* — only when there are non-obvious calls worth surfacing to the user:
  - Rename mapping (raw bullet → enhanced bullet) for items where the rewrite is non-trivial.
  - List of items dropped, with one-line reason per item.
  - Open questions for the user (e.g. "Should `#6488` overlay-API addition stay under Other ? It's only useful to embedders.").
  - Any place the source-of-truth diverged from the PR body (e.g. canonical env-var name).

### 9. Verify nothing was pushed to GitHub

This skill **never** runs `gh release edit`, `gh release create`, or any write operation against the repo. The user explicitly directed: *"Everything should be drafted in local files. Don't push anything or change anything in GitHub."* Draft files are the only output. If the user later asks you to apply, that is a separate, explicit request.

## Output format

The file saved to `claude/release-notes/<tag>-draft.md` follows this shape exactly:

```markdown
## Features

* <one bullet per change>

## Fixes

* <one bullet per change>

## Other

* <only consumer-, embedder-, theme-, or maintainer-relevant items>

## Deployment Changes

### New environment variables
<table>

### Deprecated environment variables
> [!CAUTION]
> …
<table>

### Behavioral changes
> [!NOTE]
> …
- <item>
```

Section order: `Features` → `Fixes` → `Other` → `Deployment Changes`. Subsections inside `Deployment Changes` appear in the order: New env vars → Deprecated env vars → Removed env vars → Behavioral changes.

A delta `rc` release uses the same shape — no preamble paragraph, no header pointing at the previous rc.

## Return to the main conversation

Return a short summary — five lines or fewer. Include:

- The draft path (`claude/release-notes/<tag>-draft.md`).
- Counts of bullets per section after enhancement.
- Reclassifications that happened (e.g. "moved 2 from Other → Features, 1 from Other → Fixes, dropped 11 `chat-e2e` items").
- Items dropped (count, with one example).
- Whether a `Deployment Changes` section was added and which subsections.
- Any open questions for the user (env-var name disagreement between README and `process.env.X` site, ambiguous `[Overlay]` vs Features categorization, build-time vs runtime classification of a `NEXT_PUBLIC_*` change).

Example:

> Drafted `claude/release-notes/0.45.0-rc.55-draft.md`. 4 Features, 6 Fixes, 2 Other (both `[Overlay]`). Reclassified 1 from Other → Features (`feat(overlay)` exposing `subscribeToEvents`) and dropped 14 `chat-e2e` items, 1 Storybook bump, and a revert+original pair on `#6401`. Folded 2 PRs (`#6135`, `#6430`) into one bullet on Issue #4696. Added Deployment Changes with New env vars (`THEMES_CONFIG_HOST` default changed) + Behavioral changes (aggressive history prefetch rolled back). One open: README says `NEXT_PUBLIC_USE_MD_SIDEBAR_OVERLAY_BREAKPOINT`, code reads `process.env.NEXT_PUBLIC_USE_MD_SIDEBAR_BREAKPOINT` — used the code name; flagged in editorial notes.

## Safety rails

- **Never edit GitHub.** No `gh release edit`, no `gh release create`. Drafts only.
- **Never invent items.** Every kept bullet maps to a PR or a commit hash in the range.
- **Never silently rename or drop a PR reference.** The bullet ends with the canonical `(Issue #<N>) (#<PR>)` so links resolve on the release page.
- **Verify canonical names from source**, not from PR bodies or the README. Past PR descriptions and README rows have used pre-rename names; `process.env.X` in `apps/chat/src/**` is the source of truth.
- **Don't consolidate pre-release notes** into the stable's notes unless the user explicitly asks — each rc tag has its own page.
- **Match the terseness of the predecessor's notes.** If they're one-liners, your bullets are one-liners. The user has flagged verbose drafts twice; defer to the established style.

## Maintenance

Conventions drift as the project grows. If you notice a pattern in the raw CI notes that this skill doesn't handle (a new section the CI emits, a new conventional-commit scope that misroutes items, a recurring rewrite the user keeps asking for), surface it in your return summary and offer to update this `SKILL.md`. The user can confirm before any edit lands.