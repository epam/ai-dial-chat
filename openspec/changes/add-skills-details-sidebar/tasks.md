## 1. Library: Content summary and the Files tab

- [x] 1.1 Add optional `description` to `CatalogItemPromptContent` in `libs/catalog/src/models/item-details-data.ts` with a JSDoc stating it takes precedence over `item.description`
- [x] 1.2 Add `CatalogItemFileRow` and `CatalogItemFiles` to the same file, plus `files?: CatalogItemFiles` on `CatalogItemTabData`, each field carrying an inline JSDoc; export both types from `libs/catalog/src/index.ts`
- [x] 1.3 Add `Files = 'files'` to `CatalogDetailsTab` in `libs/catalog/src/types/detail-tab.ts` with a doc line
- [x] 1.4 Add `tabFilesLabel`, `downloadFileAriaLabel`, and `filesEmptyState` to `ItemDetailsTexts`, and `onDownloadFile?: (fileId: string) => Promise<void> | void` to `DetailsPanelProps`, in `libs/catalog/src/models/item-details-props.ts`
- [x] 1.5 Create `libs/catalog/src/components/Details/TabsContent/Files.tsx`: rows grouped by `folder` string equality in first-occurrence order, ungrouped rows first, folder headings exposed as headings for their row group, a `GhostIconButton` download control rendered only when `onDownloadFile` is supplied (`aria-label` from the texts prop, icon `aria-hidden`), and the empty-state text when `rows` is empty
- [x] 1.6 Style `Files.tsx` with logical Tailwind utilities only and typography from `ItemDetailsStyles` with `dial-*-text` defaults; confirm each default class name with `getEntityDetails("typography")` before writing it
- [x] 1.7 In `DetailsPanel.tsx`, push the Files tab after `Overview` and before `Pricing` when `item.details?.files != null` (not pre-pushed for content-first types), render it for `CatalogDetailsTab.Files`, and pass `item.details?.promptContent?.description ?? item.description` to `ContentTab`
- [x] 1.8 Add `DetailsPanel` tests: Files tab appears only when `details.files` is present; it is positioned after Overview; the active tab does not change when `files` arrives; the download button calls `onDownloadFile` with the row id verbatim; no button renders without the callback; a rejected callback leaves the panel and row unchanged
- [x] 1.9 Add `Files.tsx` tests: grouping by string equality (`scripts` and `scripts/nested` are siblings), root-level rows first, incoming row order preserved, empty-state rendering
- [x] 1.10 Add a `ContentTab` test asserting `promptContent.description` wins over `item.description` and that a prompt with neither renders no summary line
- [x] 1.11 Update `libs/catalog/README.md` for the new model types, `onDownloadFile`, and the new texts fields; run `npm exec nx test catalog` and `npm exec nx lint catalog`

## 2. Manifest parser

- [x] 2.1 Move `yaml` from `devDependencies` to `dependencies` in the root `package.json`, keeping `2.8.3`, and reinstall so the lockfile records the move
- [x] 2.2 Move `SkillAboutDetails` and `SkillEntityDetails` from `apps/chat/src/types/entity-details.ts` to `apps/chat/src/types/skill.ts` and update importers
- [x] 2.3 Create `apps/chat/src/utils/skill-manifest.ts` exporting `parseSkillManifest(raw): SkillManifest` — leading-fence scan (BOM and leading whitespace tolerated), `yaml.parse` of the fence body, single leading blank line stripped from `body`, whole input returned as `body` when there is no opening fence, no closing fence, or the parse throws
- [x] 2.4 Implement the alias table from design D1 with exact key matching, post-parse type checks (non-string scalars dropped, lists filtered to strings, bare string promoted to a one-element array, empty values omitted), and `about` left `undefined` when no `about.*` field resolved
- [x] 2.5 Unit-test `parseSkillManifest`: frontmatter present; no frontmatter; unterminated fence; frontmatter-only (empty body); all three spellings per field; flow and block sequences; scalar promoted to list; wrong-typed value dropped; unrecognised keys ignored; malformed YAML returns the whole input as body without throwing; `about` undefined when only `name`/`description` are present

## 3. App mappers

- [x] 3.1 Split `buildSkillOverview` in `apps/chat/src/utils/map-skill-to-catalog-item.ts` into a Specification section (when-to-use, allowed tools, bundled resources — each row omitted when absent, whole section omitted when empty, `skillPrompt` never rendered) followed by the Details section (author, updated, file count); remove the per-file rows
- [x] 3.2 Add `buildSkillFiles(files, t)` to the same file: `nodeType: 'item'` entries only, `id` = the entry's file path, `name` = its last segment, `folder` = its parent path (omitted at root), `updatedLabel` = `formatLastUsed(file.updatedAt)`
- [x] 3.3 Delete `mapSkillDetails` from `apps/chat/src/utils/map-entity-details-to-catalog.ts` and the `{ type: 'SKILL' }` member from `EntitySpecificDetails`; confirm the switch in `mapEntityDetailsToCatalogDetails` still compiles exhaustively
- [x] 3.4 Unit-test the split overview: frontmatter present → both sections; no frontmatter → Details only; every `about` field absent → no Specification section; `skillPrompt` present → no row for it; author absent → author row omitted; folders excluded from the count; no per-file rows
- [x] 3.5 Unit-test `buildSkillFiles`: grouping folders excluded, root-level file has no `folder`, nested file's `folder` is its parent path, `id` round-trips the listing entry's path

## 4. i18n

- [x] 4.1 Add `catalog.details.skill.specificationSection`, `catalog.details.skill.whenToUse`, `catalog.details.skill.allowedTools`, `catalog.details.skill.bundledResources`, `catalog.details.skill.fileDownloadError`, `catalog.details.tabFiles`, `catalog.details.downloadFileAriaLabel`, and `catalog.details.filesEmptyState` to `CatalogI18nKeys` and `en.json`
- [x] 4.2 Grep each new English value in `en.json` first and reuse an existing key (`ButtonsI18nKeys` in particular) wherever the string already exists rather than declaring a duplicate
- [x] 4.3 Remove `catalog.details.skill.file` from `CatalogI18nKeys` and `en.json` — the per-file Overview rows it labelled no longer exist

## 5. CatalogView wiring

- [x] 5.1 In the Skill branch of `handleFetchDetails`, pass the successfully-read manifest through `parseSkillManifest` and build `promptContent` from `{ content: body, description }`, omitting `description` when absent
- [x] 5.2 Build the overview from the parsed `about` plus the listing, and build `files` from the listing; return each half independently and resolve `undefined` only when both the manifest read and the listing failed
- [x] 5.3 Keep the size guard ahead of the parse: `readSkillManifest` returning `null` must short-circuit before `parseSkillManifest` is called
- [x] 5.4 Add `onDownloadFile` to the details props, resolving through `downloadSkillFile` with the opened skill's `{ bucket, path }` and the row id as the file path, and surfacing one `useOperationNotification` on rejection with `catalog.details.skill.fileDownloadError`
- [x] 5.5 Pass the new Files tab, aria-label, and empty-state strings through `detailsTexts`
- [ ] 5.6 Extend `CatalogView.spec.tsx`: manifest with frontmatter yields body + description + Specification; manifest without frontmatter yields body only; malformed frontmatter yields the raw text as body with no notification; oversized manifest never calls `parseSkillManifest`; listing failure yields no `files`; download calls `downloadSkillFile` with the right arguments; download rejection notifies once
- [ ] 5.7 Run `npm exec nx test chat` and `npm exec nx lint chat`

## 6. Verification and rollout

- [ ] 6.1 Run `npm exec nx build chat` and compare the catalog chunk size against the pre-change build; if the `yaml` delta is material, switch to `await import('yaml')` inside the async skill branch and re-measure
- [ ] 6.2 Manually verify against a running stack with real skills: the Content tab shows the description as a summary and prose below with no `---` artefacts; a skill with no frontmatter renders unchanged; the Overview shows Specification then Details with no file rows; the Files tab lists files grouped by folder; a file downloads; the selected tab does not shift as details resolve; `OverlayFeature.Skills` off restores today's catalog
- [ ] 6.3 Resolve design.md's open question 1 during 6.2 — record which frontmatter keys the deployed skills actually use and extend or trim the alias table before merge
- [ ] 6.4 Confirm `mapSkillDetails` and `type: 'SKILL'` no longer appear anywhere in `apps/chat/src`
- [ ] 6.5 Run `npm exec nx affected --target=test --base=origin/development-1.0` and confirm the catalog and chat projects are green; confirm `npm run openapi:check` is untouched by this change
- [ ] 6.6 Run the five-axis review from `./.claude/skills/code-review-and-quality/SKILL.md` over the diff, paying explicit attention to the `libs/*` isolation rule for the Files tab and the `promptContent.description` addition
