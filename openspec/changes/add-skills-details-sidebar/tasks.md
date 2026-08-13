## 1. Library: Content summary and the file picker

- [x] 1.1 Add optional `description` to `CatalogItemPromptContent` in `libs/catalog/src/models/item-details-data.ts` with a JSDoc stating it takes precedence over `item.description`
- [x] 1.2 Add `CatalogContentFile`, plus `files?` and `selectedFileId?` on `CatalogItemPromptContent`, each field carrying an inline JSDoc; export the type from `libs/catalog/src/index.ts`
- [x] 1.3 Add `contentFileSelectorAriaLabel`, `contentFileCountLabel`, `contentFileLoadingLabel`, and `contentFileErrorLabel` to `ItemDetailsTexts`; add `contentFileCountClassName` to `ItemDetailsTypography` and `contentFileCountText` to `ItemDetailsColors`
- [x] 1.4 Add `onLoadContentFile?: (fileId: string) => Promise<string | undefined>` to `DetailsPanelProps` and `CatalogProps`, and forward it through `Catalog.tsx`
- [x] 1.5 Render the picker in `Content.tsx` with `InlineSelect` — only when two or more files are supplied — plus the file-count text beside it, and an `aria-live` status region while a file loads
- [x] 1.6 Style the picker row with logical Tailwind utilities and `dial-*-text` defaults confirmed against `getEntityDetails("typography")`; add the `--cat-details-file-count-text` var to `Content.module.scss` and to `DetailsPanel`'s `buildCssVars`
- [x] 1.7 Hold the picked file in `DetailsPanel` as an overlay over the fetched body: call `onLoadContentFile` for any other file, restore the base body with no request when `selectedFileId` is reselected, render `contentFileErrorLabel` on rejection or `undefined`, and clear the overlay when `item.id` or `selectedFileId` changes
- [x] 1.8 Pass `promptContent.description ?? item.description` to `ContentTab`
- [x] 1.9 Add `ContentTab` tests: no picker for zero or one file; picker and count for several; opens on `selectedFileId`; custom count label; `onSelectFile` fires with the picked id; loading status region present while loading and absent after
- [x] 1.10 Add `DetailsPanel` tests: description precedence and fallback; picked file loads and renders; reselecting the base file restores it with exactly one call; rejection and `undefined` both render the error text; switching item drops the picked file
- [x] 1.11 Update `libs/catalog/README.md` for `promptContent.description`, the multi-file content section, and `onLoadContentFile`; run the catalog suite and lint

## 2. Manifest parser

- [x] 2.1 Move `yaml` from `devDependencies` to `dependencies` in the root `package.json`, keeping `2.8.3`, and reinstall so the lockfile records the move
- [x] 2.2 Move `SkillAboutDetails` and `SkillEntityDetails` from `apps/chat/src/types/entity-details.ts` to `apps/chat/src/types/skill.ts` and update importers
- [x] 2.3 Create `apps/chat/src/utils/skill-manifest.ts` exporting `parseSkillManifest(raw): SkillManifest` — leading-fence scan (BOM and CRLF tolerated), `yaml.parse` of the fence body, single leading blank line stripped from `body`, whole input returned as `body` when there is no opening fence, no closing fence, or the parse throws
- [x] 2.4 Implement the alias table from design D1 with exact key matching, post-parse type checks (non-string scalars dropped, lists filtered to strings, bare string promoted to a one-element array, empty values omitted), and `about` left `undefined` when no `about.*` field resolved
- [x] 2.5 Unit-test `parseSkillManifest`: frontmatter present; no frontmatter; unterminated fence; frontmatter-only (empty body); BOM + CRLF; all three spellings per field; flow and block sequences; scalar promoted to list; wrong-typed value dropped; unrecognised keys ignored; malformed YAML returns the whole input as body without throwing; `about` undefined when only `name`/`description` are present

## 3. App mappers

- [x] 3.1 Split `buildSkillOverview` into a Specification section (when-to-use, allowed tools, bundled resources — each row omitted when absent, whole section omitted when empty, `skillPrompt` never rendered) followed by the Details section (author, updated, file count); remove the per-file rows
- [x] 3.2 Add `buildSkillContentFiles(files)`: `nodeType: 'item'` entries only, the entry path as both `id` and `name`, manifest first then the rest alphabetically
- [x] 3.3 Delete `mapSkillDetails` from `apps/chat/src/utils/map-entity-details-to-catalog.ts` and the `{ type: 'SKILL' }` member from `EntitySpecificDetails`; confirm the switch still compiles exhaustively
- [x] 3.4 Unit-test the split overview: frontmatter present → both sections; no frontmatter → Details only; every `about` field absent → no Specification section; `skillPrompt` present → no row for it; author absent → author row omitted; folders excluded from the count; no per-file rows
- [x] 3.5 Unit-test `buildSkillContentFiles`: grouping folders excluded, manifest ordered first, path used verbatim as id and name, empty listing yields no options

## 4. i18n

- [x] 4.1 Add `catalog.details.skill.specificationSection`, `.whenToUse`, `.allowedTools`, `.bundledResources`, plus `catalog.details.contentFileSelectorAriaLabel`, `.contentFileCount`, `.contentFileLoading`, and `.contentFileError` to `CatalogI18nKeys` and `en.json`
- [x] 4.2 Grep each new English value in `en.json` first and reuse an existing key wherever the string already exists rather than declaring a duplicate
- [x] 4.3 Confirm no `catalog.details.skill.*` key is left unused by the Overview split (`catalog.details.skill.file` was never declared — the per-file rows used `file.path` directly)

## 5. CatalogView wiring

- [x] 5.1 In the Skill branch of `handleFetchDetails`, pass the successfully-read manifest through `parseSkillManifest` and build `promptContent` from `{ content: body, description, files, selectedFileId }`, omitting `description` when absent
- [x] 5.2 Build the overview from the parsed `about` plus the listing; return each half independently and resolve `undefined` only when both the manifest read and the listing failed
- [x] 5.3 Keep the size guard ahead of the parse: `readSkillManifest` returning `null` must short-circuit before `parseSkillManifest` is called
- [x] 5.4 Add `onLoadContentFile`, resolving through `downloadSkillFile` with the opened skill's `{ bucket, path }` (held in a ref set when the panel opens) and the picked id as the file path, reading through `readSkillManifest` and stripping frontmatter only for `SKILL.md`
- [x] 5.5 Pass the picker's aria-label, count, loading, and error strings through `detailsTexts`
- [x] 5.6 Extend `CatalogView.spec.tsx`: manifest with frontmatter yields body + description + Specification; manifest without frontmatter yields body only; malformed frontmatter yields the raw text as body with no notification; oversized manifest never calls `parseSkillManifest`; picker options exclude grouping folders and default to `SKILL.md`; listing failure yields no options
- [x] 5.7 Run the chat skill specs and `npm exec nx lint @epam/chat`

## 6. Verification and rollout

- [ ] 6.1 Run `npm exec nx build chat` and compare the catalog chunk size against the pre-change build; if the `yaml` delta is material, switch to `await import('yaml')` inside the async skill branch and re-measure
- [ ] 6.2 Manually verify against a running stack with real skills: the Content tab shows the description as a summary and prose below with no `---` artefacts; a skill with no frontmatter renders unchanged; the Overview shows Specification then Details with no file rows; a multi-file skill shows the picker and count and switches files; a single-file skill shows no picker; the tab row is unchanged; `OverlayFeature.Skills` off restores today's catalog
- [ ] 6.3 Resolve design.md's open question 1 during 6.2 — record which frontmatter keys the deployed skills actually use and extend or trim the alias table before merge
- [x] 6.4 Confirm `mapSkillDetails` and `type: 'SKILL'` no longer appear anywhere in `apps/chat/src`
- [ ] 6.5 Run `npm exec nx affected --target=test --base=origin/development-1.0` and confirm the catalog and chat projects are green; confirm `npm run openapi:check` is untouched by this change
- [ ] 6.6 Run the five-axis review from `./.claude/skills/code-review-and-quality/SKILL.md` over the diff, paying explicit attention to the `libs/*` isolation rule for the picker and the `promptContent` additions
