## Context

The skill details sidebar shipped in `add-skill-catalog-listing` (archived 2026-08-13). Its scope was deliberately minimal: get skills visible, read `SKILL.md`, list the files, ship nothing that needs a new lib component. Two of its own tasks are still open — `8.3` (manual verification against a running stack) and `8.5` (whether the `public` skills bucket exists in target deployments) — and neither blocks this change.

What that change left behind is a panel that shows a skill's manifest verbatim and its files as inert rows:

- `CatalogView.tsx:435-464` — the skill branch: `downloadSkillFile(bucket, path, 'SKILL.md')` and `listSkillFiles({ recursive: true })` through `Promise.allSettled`, mapped to `{ promptContent, overview }`.
- `map-skill-to-catalog-item.ts:83-119` — `buildSkillOverview`, one flat section.
- `DetailsPanel.tsx:392-449` — the tab derivation: a tab exists iff its `item.details.*` field is non-null, except Content, which a content-first type always gets.

Three constraints shape everything below.

**Library isolation.** `libs/catalog` may not learn what a skill is, what a bucket is, or that `SKILL.md` exists. It takes resolved rows and returns opaque ids through callbacks. Every decision here that could have been "add a skill branch to the lib" is instead "add a generic field the app populates".

**Tab-row stability.** `DetailsPanel` deliberately keeps a content-first type's Content tab present before details resolve (`DetailsPanel.tsx:401-411`) so the opening tab never shifts under the user. Anything this change adds to the tab row has to respect that.

**The manifest is user-authored.** A skill's `SKILL.md` is written by whoever uploaded the skill. Its frontmatter can be absent, malformed, or use any of several key spellings. Nothing the panel does may depend on it being well-formed.

## Goals / Non-Goals

**Goals:**

- Render a skill's manifest as the prose it is, with its frontmatter lifted into structured UI instead of shown as body text.
- Surface `whenToUse` / `allowedTools` / `bundledResources` — fields the codebase already models but never populates.
- Turn the file inventory into a browsable tab with a per-file download.
- Keep every addition to `libs/catalog` entity-agnostic and optional.
- Leave one skill-details mapper in the tree, not two.

**Non-Goals:**

- File preview, file editing, or any skill mutation.
- Any backend, DTO, or OpenAPI change.
- Changing how prompts render.
- Restoring an About tab for skills.

## Decisions

### D1 — Parse the frontmatter in the app, with `yaml`

The parser lives at `apps/chat/src/utils/skill-manifest.ts` and exposes one function:

```ts
export const parseSkillManifest = (raw: string): SkillManifest => { ... };
```

`SkillManifest` is `{ about?: SkillAboutDetails; body: string }`. The split is a leading-fence scan, not a YAML parse of the whole file: if the text does not begin with `---` on its own line, the whole text is `body` and `about` is `undefined`. If it does, everything up to the next `---` line goes to `yaml.parse`, the remainder is `body`, and a `yaml` throw is caught and downgraded to the same body-only result.

Key resolution accepts alias spellings per field, since manifests are authored by hand against different conventions:

| `SkillAboutDetails` field | Accepted keys                                          |
| ------------------------- | ------------------------------------------------------ |
| `whenToUse`               | `when_to_use`, `when-to-use`, `whenToUse`              |
| `allowedTools`            | `allowed_tools`, `allowed-tools`, `allowedTools`       |
| `bundledResources`        | `bundled_resources`, `bundled-resources`, `bundledResources` |
| `skillPrompt`             | `skill_prompt`, `skill-prompt`, `skillPrompt`          |

`description` and `name` are read for the Content summary and are not part of `SkillAboutDetails`. Values are type-checked after parsing — a string field that parsed to an object is dropped, and a list field accepts an array of strings or a single string (promoted to a one-element array). Unrecognised keys are ignored silently; a manifest is not a schema this product owns.

**Why `yaml` and not a hand-rolled scanner.** The failure modes differ in kind. `yaml` on bad input throws, which we catch and degrade cleanly. A hand-rolled scanner on `description: "Reads a file: then summarises"` produces `"Reads a file` and calls it a success — a wrong value rendered as fact. The package is already in the lockfile at `2.8.3` and moves `devDependencies` → `dependencies`. It is reachable only from the catalog chunk. If task 6.1's bundle measurement makes the cost unacceptable, the escape hatch is `await import('yaml')` inside the skill branch, which is already an `async` function — not a bespoke parser.

**Order with the size guard.** `readSkillManifest` (`map-skill-to-catalog-item.ts:126-141`) rejects an oversized body before decoding and returns `null`. That check stays exactly where it is and runs first: parsing happens on the decoded string, so a 300 KB manifest is never handed to `yaml`.

### D2 — The description goes in Content's summary slot, not a restored About tab

`ContentTab` already renders `description` above a divider (`Content.tsx:33-42`) and is already passed `item.description` (`DetailsPanel.tsx:779-783`). For a skill that value is `''`, hard-coded by the list mapper (`map-skill-to-catalog-item.ts:56`), because skill metadata genuinely has no description — only the manifest does, and the manifest is fetched lazily.

The fix is to let the details fetch supply it: `CatalogItemPromptContent` gains an optional `description`, and `DetailsPanel` renders `item.details?.promptContent?.description ?? item.description`. Prompts pass nothing and are unaffected.

**Why not an About tab.** `item.description` is populated by the list mapper, before the panel opens, which is why About can be tab #1 without shifting. A skill's description exists only after `onFetchDetails` settles. An About tab derived from it would materialise mid-interaction and push Content one slot right while the user is reading it. The summary slot delivers the same text at the same moment with no tab-row movement.

**Alternative rejected:** having the app write the description back onto the `CatalogItem` after the fetch. `Catalog.tsx` merges the fetch result into `item.details` only (`Catalog.tsx:298-307`); widening that merge to arbitrary item fields makes the fetch result able to rewrite name, version, or ownership, which is a much larger contract than one summary line.

### D3 — Files become a tab, with a generic model

`CatalogItemTabData` gains `files?: CatalogItemFiles`:

```ts
export interface CatalogItemFileRow {
  /** Opaque id passed back to `onDownloadFile`; never parsed by the lib. */
  id: string;
  /** File name shown in the row. */
  name: string;
  /** Folder path this file is grouped under. Root-level files omit it. */
  folder?: string;
  /** Preformatted last-updated string, already localised by the host. */
  updatedLabel?: string;
}

export interface CatalogItemFiles {
  /** Ordered file rows. Grouping is derived from `folder`, preserving this order. */
  rows: CatalogItemFileRow[];
}
```

`DetailsPanelProps` gains `onDownloadFile?: (fileId: string) => Promise<void> | void`. The download button renders only when the callback is supplied, matching how `onDownload` already gates the item-level download (`item-details-props.ts:376-379`).

The lib groups by the `folder` string with no path semantics: it compares strings, it does not split on `/` or build a tree. Depth, separators, and encoding stay the app's business. `CatalogDetailsTab.Files` is pushed after `Overview` and before `Pricing`, and only when `details.files` is non-null — so for a skill it appears when the listing resolves, always after the tab the user is on.

**Why a tab rather than an Overview section.** Overview's row model is `{ label, value }` (`item-overview.ts:2-12`) with `value` rendered as text or a yes/no glyph. A per-row action button has nowhere to live in it, and widening `OverviewSpec` with an optional action would put a file-browser concern into the model every entity's Overview shares.

**Why not a folder tree.** The skills listing is recursive and flat; skill file layouts are one or two levels deep. A flat list with folder headers is the smaller component and the one the data actually supports. A tree is a later change if depth ever warrants it.

### D4 — `buildSkillOverview` splits; the dead mapper is deleted

`buildSkillOverview` returns two sections instead of one:

- **Specification** — `whenToUse`, `allowedTools` (joined with ` · `, matching the existing deployment mappers), `bundledResources`. Each row is omitted when its field is absent, and the whole section is omitted when every row is. `skillPrompt` is not rendered: it duplicates the manifest body already on the Content tab.
- **Details** — author (omitted when absent, as today), last updated, file count. This reuses `catalog.details.skill.section` as its title and the three existing `catalog.details.skill.*` row keys.

A new `buildSkillFiles(files, t)` produces the `CatalogItemFiles` rows, applying the same `nodeType === Item` filter that already excludes grouping folders from the count.

`mapSkillDetails` (`map-entity-details-to-catalog.ts:480-508`) and the `{ type: 'SKILL' }` member of `EntitySpecificDetails` (`entity-details.ts:274`) are deleted. `SkillAboutDetails` and `SkillEntityDetails` move from `entity-details.ts` to `types/skill.ts`, where the rest of the skill vocabulary lives; `SkillEntityDetails` is kept as the parser's `about` container so the shape stays named.

**Why delete rather than wire.** `mapSkillDetails` hangs off `EntitySpecificDetails`, which exists solely as the output of `mapDeploymentDetailsDtoToEntityDetails`. Skills never touch the deployment details endpoint — the branch returns at `CatalogView.tsx:464` before it. Keeping a second skill mapper on a union skills can never enter leaves the next reader a plausible wrong wire-up, and its labels are hardcoded English (`'Allowed tools'`, `'Specification'`) where the live skill path threads `t`.

### D5 — Failure isolation is per-half, unchanged

The existing contract holds: manifest and listing settle independently, each half is optional, and both failing resolves `undefined`. This change adds one nesting level inside the manifest half — a manifest that downloads but fails to parse still yields `promptContent.content` (the raw text as body) with no `description` and no Specification section. Parse failure is strictly weaker than fetch failure and must never escalate to one.

A per-file download rejection is handled at the app edge through `useOperationNotification`, the path the catalog already uses for its listing error (`CatalogView.tsx:262`). The panel stays open; the row is not marked failed.

## Risks / Trade-offs

- **`yaml` in the runtime bundle** → It loads only inside the catalog route chunk. Task 6.1 measures `npm exec nx build chat` output before and after; if the delta is material, switch to `await import('yaml')` inside the already-async skill branch.
- **Alias-key guessing is a heuristic** → A manifest using a key spelling not in D1's table silently shows no Specification section rather than erroring. Mitigation: the body still renders in full, so no information is lost — only its promotion to structured rows. The accepted-key table is the spec's contract and is the single place to extend.
- **Frontmatter can be huge** → A pathological manifest whose fence is most of the file would hand ~256 KB to `yaml`. The existing `SKILL_MANIFEST_MAX_BYTES` guard caps the input; parsing a quarter-megabyte of YAML once, on an explicit user action, is acceptable and no further cap is added.
- **A file id is opaque to the lib but must round-trip** → The app passes the file's full path as `id` and re-parses it in `onDownloadFile` alongside the skill's own `{ bucket, path }`. If the two ever disagree the download 404s. Mitigation: build ids in `buildSkillFiles` from the same listing entries the rows come from, and unit-test the round trip.
- **Two sections where there was one** → Users who read the current Overview see its shape change. This is a young feature behind `OverlayFeature.Skills`; no migration is warranted.
- **`CatalogItemPromptContent.description` is prompt-named but skill-used** → The interface name predates skills and already serves both (`Skill` shares `promptContent` today). Renaming it is a wider rename across the lib's public API and is deliberately not bundled here.

## Migration Plan

Ship in the order of `tasks.md`: lib first (additive fields nothing yet populates), then the parser, then the app wiring, then the deletion. Each step leaves the tree green and the panel working.

**Rollback.** Revert per-commit. Lib-only revert: the app sets `description` and `files` the lib ignores — the Content summary and Files tab disappear, everything else works. App-only revert: the lib carries two optional fields no host populates, so no Files tab is derived. Full revert restores today's panel. Runtime kill switch: `OverlayFeature.Skills` off removes the surface entirely, as it does today.

## Open Questions

1. **Which frontmatter keys do the skills in the target deployments actually use?** D1's table is inferred from `SkillAboutDetails`, which was written before any manifest was read. Confirm against real `SKILL.md` files during task 6.2 and extend or trim the table before merge.
2. **Should `bundledResources` link to the Files tab?** The field names files the skill ships. Rendering it as plain text duplicates information the Files tab holds. Left as text for now; revisit once real manifests show whether the two lists agree.
3. **Inherited from `add-skill-catalog-listing` and still open:** whether the `public` skills bucket exists in target deployments (task 8.5 there). Unresolved either way this change is unaffected — it touches the details panel, not the listing.
