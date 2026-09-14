# Tasks

**Slicing strategy: risk-first, then vertical.**

Group 3 comes before any UI that writes the new preference, because
`resolveInitialSelection` is the one place this change can silently alter which model a user's next
chat starts with. Proving the precedence — including that the default reproduces today's behaviour —
before a control exists to write a non-default value means a regression there surfaces as a red
unit test rather than as a user's chat opening on the wrong agent. After that, each group is a
vertical slice that ends in a rendered, independently verifiable surface.

Group 2 (the tab with only the keyboard row) is deliberately the first UI: it reuses an existing
hook with existing i18n keys, so it exercises the shell wiring with nothing else able to fail.

---

## 1. Groundwork: i18n keys and the tab id

- [x] 1.1 Add `Preferences = 'settings.preferences'`, `PreferencesDescription = 'settings.preferencesDescription'`, `DefaultAgent = 'settings.defaultAgent'`, `DefaultAgentOptionDefault = 'settings.defaultAgentOptionDefault'`, `DefaultAgentOptionLastUsed = 'settings.defaultAgentOptionLastUsed'` and `DefaultAgentSearchPlaceholder = 'settings.defaultAgentSearchPlaceholder'` to `SettingsI18nKeys` in `apps/chat/src/constants/translation-keys.ts`, and the matching entries to `apps/chat/src/i18n/locales/en.json` under `settings`. Before adding each one, grep its English value in `en.json` — per `.claude/rules/all-ts.md`, a generic label that already exists (e.g. under `ButtonsI18nKeys`) must be reused rather than re-declared. `Default agent` and `Last used agent` are the chat 1.0 wordings; keep them.
  **Outcome:** `DefaultAgentSearchPlaceholder` was **not** added — `deploymentSelector.searchPlaceholder`
  ("Search models, agents…") already carries exactly that string, so per this task's own reuse rule
  `DeploymentSelectorI18nKeys.SearchPlaceholder` is used instead. Five keys added, not six.
- [x] 1.2 Add `Preferences = 'preferences'` to the `SettingsTabs` enum in `apps/chat/src/types/settings-tabs.ts`.
- [x] 1.3 Create the `DefaultAgentMode` string enum in `apps/chat/src/types/default-agent.ts` with `DefaultAgent = 'default-agent'` and `LastUsedAgent = 'last-used-agent'`, and add `DefaultAgent = 'defaultAgent'` to `StorageKey` in `apps/chat/src/types/storage-key.ts`.

### Verification

- `npm run verify:changed`

---

## 2. Slice 1 — the Preferences tab, rendering only the keyboard row

- [x] 2.1 Create `apps/chat/src/pages/SettingsPage/PreferencesTab/PreferencesTab.tsx` following `UsageTab.tsx`'s structure: `const PreferencesTab: FC = () => ...` with `export default memo(PreferencesTab)`, an `<h2 class="dial-h1-text m-0 text-primary">` carrying `t(SettingsI18nKeys.Preferences)` and a `<p class="dial-small-text m-0 text-secondary">` carrying `t(SettingsI18nKeys.PreferencesDescription)`, over a scrollable, vertically stacked body. Use only direction-agnostic or logical spacing utilities — no `pl-*`/`pr-*`/`ml-*`/`mr-*`/`text-left`/`text-right`.
- [x] 2.2 Render the keyboard-shortcut row in `PreferencesTab` as a ui-kit 2.0 `Select` from `@epam/ai-dial-ui-kit` with `labelProps={{ label: t(SettingsI18nKeys.KeyboardShortcuts) }}`, `value={preference}` and `onChange` calling `setPreference`, over `useKeyboardShortcutPreference()`. Two options in order: `settings.shortcutEnter` → `SendOnEnter.Enter`, then `settings.shortcutMetaEnter` interpolated with the existing `metaKey` export → `SendOnEnter.MetaEnter`. Build `options` inside a `useMemo` keyed on `[t]`. Suppress the row when `useUiFeature(OverlayFeature.HideUserSettings)` or `useUiFeature(OverlayFeature.HideKeyboardShortcuts)` is on. Confirm the `Select` prop signature with `getEntityDetails("component", "Select")` before writing the call — do not assume it from this task text.
- [x] 2.3 Render the shared empty state in place of the body when every row is suppressed. Look up the current empty-state component with `searchEntity("component", "no data")` rather than assuming a name.
- [x] 2.4 Register the tab in `apps/chat/src/hooks/useSettingsTabConfig.tsx`: one `entries` element **after** the existing `Usage` element, with `item.id: SettingsTabs.Preferences`, `item.label: t(SettingsI18nKeys.Preferences)`, `item.icon: <IconAdjustmentsHorizontal size={DIAL_ICON_SIZE.MD} aria-hidden stroke={DIAL_KIT_ICON_STROKE} />`, and `Component: PreferencesTab`. Do not touch `SettingsPage.tsx`, `app.tsx`, or `libs/settings-panel`.
- [x] 2.5 Write `apps/chat/src/pages/SettingsPage/PreferencesTab/tests/PreferencesTab.spec.tsx` covering: the keyboard select is present with both options and its accessible name; selecting the meta option calls `setPreference(SendOnEnter.MetaEnter)`; the modifier label interpolates `⌘` on macOS and `Ctrl` elsewhere; `HideKeyboardShortcuts` removes the row; `HideUserSettings` removes every row and shows the empty state; heading order is `h2` under the shell's `h1`. Query by role, label and text only — no `data-testid` (`.claude/rules/a11y.md`, and the repo convention).
- [x] 2.6 Extend `apps/chat/src/pages/SettingsPage/tests/SettingsPage.spec.tsx` for two rows: the rail renders `Usage` then `Preferences`, `Usage` is selected on mount, activating `Preferences` swaps the pane and sets `aria-selected`, `ArrowDown` from `Usage` moves focus and selection to `Preferences`, and the selected row is now visually highlighted (`items.length > 1` satisfies `SettingsPanel`'s `isVisuallyActive` guard).

### Verification

- `npm run test:file -- apps/chat/src/pages/SettingsPage/PreferencesTab/tests/PreferencesTab.spec.tsx`
- `npm run test:file -- apps/chat/src/pages/SettingsPage/tests/SettingsPage.spec.tsx`
- `npm run verify:changed`

---

## 3. Slice 2 — the `Default agent for new chats` preference and its resolution (risk-first)

- [x] 3.1 Create `apps/chat/src/hooks/default-agent/useDefaultAgentPreference.ts`, mirroring `apps/chat/src/hooks/keyboard-shortcut/useKeyboardShortcutPreference.ts` file-for-file: a module-level `PREFERENCE_CHANGE_EVENT` constant, a `readStoredPreference` reading `StorageKey.DefaultAgent` through `getFromLocalStorage` and defaulting to `DefaultAgentMode.LastUsedAgent`, `useState(readStoredPreference)`, a `useEffect` subscribing to the `window` `CustomEvent` and removing the listener on unmount, and a `setPreference` that writes localStorage, sets state and dispatches the event. Return `{ preference, setPreference }`. Use a distinct event name from the keyboard hook's. Arrow-function consts only, JSDoc on the hook explaining **why** the `CustomEvent` exists (`DeploymentsContext` and the Preferences tab are both mounted and must agree without a reload).
- [x] 3.2 Write `apps/chat/src/hooks/default-agent/tests/useDefaultAgentPreference.spec.ts`: default is `LastUsedAgent` with no stored value; a stored deployment id is loaded on mount; `setPreference` persists and updates; a change in one instance reaches a second mounted instance on the same render cycle; no fetch is issued on write.
- [x] 3.3 Extend `resolveInitialSelection` in `apps/chat/src/context/DeploymentsContext.tsx` with a `defaultAgent: string` parameter and implement the six-step precedence from `specs/default-agent-preference/spec.md`. Insert the two new steps between the existing `inMemoryId` check and the existing pinned-operator-default check. Do not write nested ternaries (`.claude/rules/all-ts.md`) — the existing early-return `if` style already fits.
- [x] 3.4 In `DeploymentsProvider`, call `useDefaultAgentPreference()` and hold the value in a `defaultAgentRef` kept current by a `useEffect`, alongside the four existing refs. Pass `defaultAgentRef.current` from both call sites: the post-fetch resolution effect (around `DeploymentsContext.tsx:318`) and `restoreDefaultSelection` (around line 536). **`restoreDefaultSelection`'s `useCallback` dependency array must stay `[]`** — add a comment next to the new ref pointing at the existing lines 459-465 rationale, so a later reader does not "fix" it by adding the dependency.
  **Outcome:** there turned out to be a **third** call site — the late-config re-resolution effect
  guarded by `selectionExplicitlySetRef.current || rawDeployments.length === 0`. It runs after
  `loadDeployments` and overwrote the selection, leaving both new precedence steps dead on first
  load (caught by two red tests in 3.5). Being a dependency-driven effect rather than a stable
  callback, it takes the live preference and lists it as a dependency. `design.md` §Decision 5 and
  `specs/default-agent-preference/spec.md` were corrected to say three callers, not two.
- [x] 3.5 Extend `apps/chat/src/context/tests/DeploymentsContext.spec.tsx` with one case per precedence scenario in `specs/default-agent-preference/spec.md`: preference naming a specific agent beats a pinned operator default; `DefaultAgent` resolves the operator default with `defaultDeploymentPinned` **off**; `LastUsedAgent` falls through to `userConfigSelectedId` (the no-regression case — assert it matches pre-change behaviour); an in-session pick still outranks the preference; a preference naming a deleted deployment falls through **and** leaves localStorage untouched; `DefaultAgent` with a `null` operator default falls through; `restoreDefaultSelection`'s identity is stable across a preference change.
- [x] 3.6 Confirm no existing `DeploymentsContext` or `ConversationRoute` test changes behaviour under the new default. If any existing assertion shifts, that is a regression in 3.3/3.4, not a test to update — fix the implementation.

### Verification

- `npm run test:file -- apps/chat/src/hooks/default-agent/tests/useDefaultAgentPreference.spec.ts`
- `npm run test:file -- apps/chat/src/context/tests/DeploymentsContext.spec.tsx`
- `npm run verify:changed`

---

## 4. Slice 3 — the `Default agent for new chats` control

> **Superseded by group 17.** The searchable `Select` this slice built was later replaced by the
> deployment selector panel. The tasks below record what shipped at the time; the current design is
> in group 17 and in the requirement in `specs/settings-preferences-tab/spec.md`.

- [x] 4.1 Create `apps/chat/src/components/Settings/DefaultAgentSelect/DefaultAgentSelect.tsx` as a searchable `Select` bound to `useDefaultAgentPreference()` and `useDeployments()`. Hold the overlay query in local `searchQuery` state fed by `onSearchQueryChange`; pass `searchable` and `searchPlaceholder={t(SettingsI18nKeys.DefaultAgentSearchPlaceholder)}`. Props interface named `Props` per `.claude/rules/apps.md`; `export default memo(DefaultAgentSelect)`.
- [x] 4.2 Build the option list in a `useMemo` keyed on `[t, items, searchQuery]`: the two mode options first (no icon), then one per `items` entry with `value: item.id`, `label` from `resolveLocalizedText` (`apps/chat/src/utils/locale.ts`), `icon` from `resolveCatalogIconUrl` (`apps/chat/src/utils/icon-path.ts`), `rightControl` carrying `item.version` when present, and `labelNode: <Highlight text={name} query={searchQuery} />` from `@epam/ai-dial-ui-kit`. `Highlight` is mandatory for search-result text per `.claude/rules/search-results-highlight.md` — do not render the name as plain text and do not hand-roll a highlighter. Keep `label` as the plain string so the control's own field rendering and filtering still work.
  **Outcome:** the version field on the raw `DeploymentItemDto` is `displayVersion`, not `version` —
  `version` is the *mapped* `CatalogItem` field that `DeploymentSelectorPanel` renders. Used
  `item.displayVersion`.
- [x] 4.3 Ensure a `value` matching no option renders without throwing and without clearing the stored preference — the deleted-deployment case from 3.5, now at the UI layer.
- [x] 4.4 Render `DefaultAgentSelect` in `PreferencesTab` with `labelProps={{ label: t(SettingsI18nKeys.DefaultAgent) }}`, suppressed when `HideUserSettings` is on or `useDeployments().items` is empty.
- [x] 4.5 Write `apps/chat/src/components/Settings/DefaultAgentSelect/tests/DefaultAgentSelect.spec.tsx`: option order is `Default agent`, `Last used agent`, then the catalog; each deployment option shows its version when it has one; typing a query filters the options and renders matches through `Highlight`; selecting a deployment persists its id; selecting `Default agent` persists `'default-agent'`; a stored id absent from the catalog renders with nothing selected and the stored value intact; an empty catalog renders no row.

### Verification

- `npm run test:file -- apps/chat/src/components/Settings/DefaultAgentSelect/tests/DefaultAgentSelect.spec.tsx`
- `npm run test:file -- apps/chat/src/pages/SettingsPage/PreferencesTab/tests/PreferencesTab.spec.tsx`
- `npm run verify:changed`

---

## 5. Slice 4 — the theme and language rows

- [x] 5.1 Add the theme row to `PreferencesTab` over `useThemeOptions()` — its first call site. `value={selectedTheme}`, `onChange` calling `setTheme`, one option per `themes` entry. Label each option from the existing keys by `ThemeId` (`Light` → `settings.themeLight`, `Dark` → `settings.themeDark`, `System` → `settings.themeSystem`), falling back to the served theme's own `displayName` for an id that is not a `ThemeId` member. Render the row only when `themes` has ≥ 2 entries and `HideUserSettings` is off. Build `options` in a `useMemo` keyed on `[t, themes]`.
- [x] 5.2 Add the language row over `useLanguage()`. `onChange` calling `changeLanguage(code)`, one option per `SUPPORTED_LANGUAGES` entry labeled with its `nativeName` — **not** through a translation key. The value is the entry whose `code` matches `language` by base language code, so `en-US` selects `en`. Render the row only when `SUPPORTED_LANGUAGES.length > 1` and `HideUserSettings` is off. Build `options` in a `useMemo` keyed on `[]`/`[language]` as appropriate — `SUPPORTED_LANGUAGES` is a module constant.
- [x] 5.3 Extend `PreferencesTab.spec.tsx`: with one theme served, no theme row; with two, a select whose options carry the translated labels and whose value is `selectedTheme`, and selecting one calls `setTheme`; a served theme with an unknown id falls back to its `displayName`; with one locale, no language row; with two, options bearing each `nativeName` and `en-US` selecting the `en` option. Mock `useTheme`/`useThemeOptions` and `SUPPORTED_LANGUAGES` to reach the multi-option states — both ship single-valued, so these rows are unreachable in a default build and their tests must not assert on shipping data.

### Verification

- `npm run test:file -- apps/chat/src/pages/SettingsPage/PreferencesTab/tests/PreferencesTab.spec.tsx`
- `npm run verify:changed`

---

## 6. Slice 5 — retire the UserMenu submenus

- [x] 6.1 In `apps/chat/src/hooks/navigation/useNavigationMenuGroups.tsx`: delete the theme `TODO` block at lines 15-18 (`useThemeOptions` now has a consumer), read `useFeatureFlag('settingsPageEnabled')`, and add `settingsPageEnabled === false` to both `isLanguageGroupShown` and `isKeyboardGroupShown`.
- [x] 6.2 Add a third returned field, `mobileKeyboardGroup?`, gated **only** by `HideUserSettings` and `HideKeyboardShortcuts` — not by `settingsPageEnabled`. Extract the keyboard group's object literal to a local const so the desktop and mobile fields share one definition rather than duplicating the options array. Update the `NavigationMenuGroups` interface and its per-field doc comments to say which surface each field serves and what gates it.
- [x] 6.3 In `apps/chat/src/components/Navigation/Navigation.tsx`, destructure `mobileKeyboardGroup` and pass it to `NavigationSheet` in place of `keyboardGroup`. Replace the now-inaccurate comment at lines 121-123 with one stating the real reason the sheet keeps the group: the sheet has no Settings entry point, so gating it on `settingsPageEnabled` would leave mobile users unable to change the shortcut. The `UserMenu` `groups` prop is left as-is — it already filters `null`, and with the flag on the hook returns nothing for it.
- [x] 6.4 Write or extend `apps/chat/src/hooks/navigation/tests/useNavigationMenuGroups.spec.tsx`: with `settingsPageEnabled` on, both desktop fields are `undefined` and `mobileKeyboardGroup` is defined; with it off, the keyboard group is defined as before and the language group follows the `SUPPORTED_LANGUAGES.length > 1` rule; `HideUserSettings` clears all three fields; `HideKeyboardShortcuts` clears both keyboard fields and leaves the language field to its own rule; no theme group is ever returned under any flag combination.
- [x] 6.5 Update any `Navigation` or `UserMenu` test that asserts the dropdown's item list, so the flag-on shape is `identity → divider → Settings → Log out` and the flag-off shape is unchanged.

### Verification

- `npm run test:file -- apps/chat/src/hooks/navigation/tests/useNavigationMenuGroups.spec.tsx`
- `npm run verify:changed`

---

## 7. RTL, accessibility, and documentation

- [x] 7.1 RTL pass over the new surfaces: grep the two new component files for `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l-`, `border-r-`, `rounded-l-`, `rounded-r-` and replace each with its logical counterpart per `.claude/rules/rtl.md`. Neither surface renders a directional icon, so no `rtl:scale-x-[-1]` mirroring is needed — confirm that rather than assuming it.
- [x] 7.2 Add an RTL render case to `PreferencesTab.spec.tsx` asserting the tab renders without breakage under `dir="rtl"`.
- [x] 7.3 Accessibility pass per `.claude/rules/a11y.md`: every Tabler icon carries `aria-hidden` and `stroke={DIAL_KIT_ICON_STROKE}`; every `Select` has an accessible name from `labelProps.label`; every row is reachable and operable by keyboard alone; the deployment-option icons are decorative and marked accordingly. Verify each text-color fallback introduced in a `var(--token, #hex)` chain resolves to ≥ 7:1 — the tab reuses `text-primary`/`text-secondary` utilities, so confirm no new chain was written.
- [x] 7.4 Update `docs/architecture.md` in this same change: the new `PreferencesTab` folder under `pages/SettingsPage/`, and the `DeploymentsContext` selection-precedence change. Per `AGENTS.md`, state what the code does today; the deliberate choice to let a user's specific-agent preference outrank a pinned operator default belongs in the Decision Log, since it alters an operator-facing guarantee.
- [x] 7.5 Run `npm run validate:docs` — required after touching `docs/**`, and not covered by `lint`, `test` or `build`.

### Verification

- `npm run test:file -- apps/chat/src/pages/SettingsPage/PreferencesTab/tests/PreferencesTab.spec.tsx`
- `npm run validate:docs`
- `npm run verify:changed`

---

## 8. Close out

- [x] 8.1 Confirm the scope discipline rule held: no file outside the list in `proposal.md` §Impact was edited, and no drive-by refactor landed in a touched file. Record anything found and deliberately left alone as a follow-up here rather than fixing it inline.
  **Outcome:** held. Every file this change touches appears in `proposal.md` §Impact. The working
  tree also carries unrelated modifications under `libs/catalog`, `libs/prompts`, `libs/chat-shared`,
  `libs/builder-form`, `libs/conversation-input`, `libs/conversation-panel`,
  `components/AnnouncementsPopover` and `components/PromptSelector` — these were **already
  uncommitted on the branch** before this work began and are not part of it.

  Two incidental, non-refactor edits inside files already being changed:
  - Prettier normalised two pre-existing formatting errors in files already being edited. Measured
    against a stash of exactly this change's files on the current commit: **18 lint problems before,
    16 after** — zero introduced, two incidentally fixed, and none of the remaining 16 are in this
    change's files. (An earlier reading of "8" was taken on a different commit; the branch moved
    under this session.)
  - `docs/architecture.md`'s `pages/` route list was missing `SettingsPage` entirely — a pre-existing
    omission, fixed while documenting the tab that now lives under it.

  Left alone deliberately: `DeploymentIcon` renders initials text in its no-image fallback, which
  adds the initials to a `Default agent for new chats` option's accessible name alongside the deployment name it
  already carries. That is pre-existing `libs/chat-shared` behaviour used identically by
  `DeploymentSelectorPanel`; changing it here would be a drive-by in a lib this change otherwise does
  not touch. Follow-up (c).
- [x] 8.2 Raise the two deferred items from `design.md` §Open Questions as follow-ups, so neither reads as an oversight: (a) a Settings entry point in the mobile `NavigationSheet`, which would let the keyboard group leave the sheet and the other three rows reach mobile; (b) whether a pinned operator default should be able to override an explicit user `Default agent for new chats` agent.
  **Outcome:** raised, plus one more found during implementation:
  - **(a)** Mobile `NavigationSheet` has no Settings entry point, so the keyboard group stays there
    and the theme/language/"Default agent for new chats" rows are desktop-only. Needs a `libs/navigation-panel`
    prop and a mobile layout for `SettingsPage`'s fixed `w-[240px]` rail.
  - **(b)** Whether `defaultDeploymentPinned` should outrank an explicit user "Default agent for new chats"
    agent. Currently the user wins; recorded as Decision Log #19 (Open) in `docs/architecture.md`.
  - **(c)** `DeploymentIcon`'s initials fallback duplicates the name in an option's accessible name
    (see 8.1).
  - **(d)** `.claude/rules/all-tsx.md` now lists `DialNoDataContent` as having no 2.0 replacement,
    but the UI-kit MCP server reports it superseded by `NoDataContent` (2.0), which is what this
    change uses per AGENTS.md's "MCP is the authority for UI-kit discovery". One of the two is stale.
- [x] 8.3 Run the five-axis quality review (`.claude/skills/code-review-and-quality/SKILL.md`), including its responsive-parity and documentation-accuracy gates.
  **Outcome:** reviewed; verdict was "request changes" with three blockers, all now fixed:
  1. `SettingsPage.spec.tsx` had **2 failing tests** — activating the Preferences tab mounts
     `PreferencesTab`, which gained a `useThemeOptions()` call in slice 5, and the suite mocks no
     `ThemeContext`. A real regression introduced in 5.1 and missed because that suite was not
     re-run after slice 5. Fixed by mocking `useThemeOptions` there.
  2. **6 lint errors** in this change's files (`import/order`,
     `testing-library/render-result-naming-convention` ×4, `testing-library/no-node-access`). Fixed;
     lint is now 18 → 16 against a stashed baseline, zero introduced.
  3. **Spec drift**: `specs/settings-preferences-tab/spec.md` still named
     `SettingsI18nKeys.DefaultAgentSearchPlaceholder` (never created) and `version` (the field is
     `displayVersion`). Both corrections had been recorded in this task file but not propagated to
     the spec, which is the artifact that survives archiving. Spec and `proposal.md` both fixed.

  Non-blocking items also fixed: the empty-state scenario is now actually asserted; the
  deleted-deployment test is retitled to what it proves; the unmount test asserts listener removal
  rather than passing vacuously; `Personalise` → `Personalize` (file is otherwise US spelling); and
  language matching compares base codes instead of `startsWith`, so a future `en` would not shadow
  `en-GB` by list order.

  Accepted and **not** fixed, recorded as follow-ups: `resolveInitialSelection`'s six positional
  params (an options object would be safer but is a wider refactor of a hot path); the per-keystroke
  rebuild of deployment option nodes in `DefaultAgentSelect`; four `as string` casts forced by the
  kit's `string | string[]` `onChange` type; and `basic.noData` ("No data") reading oddly as the
  all-rows-hidden message. Also unaddressed: **no real-browser or mobile verification** — `/settings`
  hard-codes a `w-[240px]` rail with `px-8` content and has no mobile entry point, and the newly
  enabled active-row highlight has not been seen rendered. That check is the main gap in this
  change's evidence.
- [x] 8.4 Run `npm run verify:full` exactly once. No `npm run build:quiet` is needed — no bundling, route-splitting or lazy-loading boundary changed (`PreferencesTab` is a plain import inside the already-lazy `SettingsPage` chunk).

---

## 9. Remove the `settingsPageEnabled` feature flag

Added after group 8 on explicit request: the Settings page graduates from its flag and ships on for
everyone. This supersedes Decision 1's conditional gating (see `design.md` §Decision 7) and is
**breaking for operators** who set `SETTINGS_PAGE_ENABLED` / `SETTINGS_PAGE_ENABLED_ROLES`.

- [x] 9.1 Frontend read sites: drop the flag from `app.tsx` (route renders `SettingsPage`
  unconditionally; the `Navigate to={ROUTES.Root}` guard is deleted), `Navigation.tsx` (always pass
  `onSettings` and `labels.settings`), and `UsageTab.tsx` (call `useUsageData(getUserUsage)` with no
  `enabled` argument). Remove the three now-unused `useFeatureFlag` imports.
- [x] 9.2 Collapse `useNavigationMenuGroups` to a single `keyboardGroup` field for the mobile sheet:
  delete the `useFeatureFlag` read, the `languageGroup` field and its builder, and the surface-named
  `mobileKeyboardGroup`. Update `Navigation.tsx` to pass `UserMenu` no `groups` at all and the sheet
  the remaining `keyboardGroup`.
- [x] 9.3 Backend: delete the `features.settingsPageEnabled` entry from
  `config-registry.constants.ts`, `FeatureKey.SettingsPageEnabled` from `feature-key.enum.ts`, and
  `SETTINGS_PAGE_ENABLED` + `SETTINGS_PAGE_ENABLED_ROLES` from `environment.config.ts`.
- [x] 9.4 Update the tests that asserted flag behaviour: `Navigation.spec.tsx` (the user menu now
  offers no preference submenus; the Settings entry is unconditional; no language group is built at
  any locale count), `useNavigationMenuGroups.spec.tsx` (rewritten for the single-field return), and
  `SettingsPage.spec.tsx` (usage data is fetched unconditionally).
- [x] 9.5 Update `docs/architecture.md` and every affected spec delta — `settings-page-shell`
  (entry point + route requirements), `user-menu`, `language-selector`,
  `keyboard-shortcut-preference`, `settings-preferences-tab` — plus a new `usage-data-hook` delta
  for the Usage tab's call shape. Record the operator-facing break in `proposal.md` and
  `design.md` §Migration Plan.

### Verification

- `npm run test:file -- apps/chat/src/components/Navigation/tests/Navigation.spec.tsx apps/chat/src/hooks/navigation/tests/useNavigationMenuGroups.spec.tsx apps/chat/src/pages/SettingsPage/tests/SettingsPage.spec.tsx`
- `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts apps/chat-api/src/app-config/tests/app-config.service.spec.ts`
- `npm run validate:docs`
- Full `apps/chat` Vitest suite

---

## 10. Reorder the tabs: Preferences before Usage

Added after group 9 on explicit request.

- [x] 10.1 Swap the order in `SettingsTabs` (`types/settings-tabs.ts`) and in
  `useSettingsTabConfig`'s `entries` array, so the rail renders `Preferences` above `Usage`.
- [x] 10.2 Change `SettingsPage`'s initial state to `SettingsTabs.Preferences`, keeping the selected
  row and the top row the same. Leaving it on `Usage` would have highlighted the second row on
  arrival, which reads as a bug.
- [x] 10.3 Update `SettingsPage.spec.tsx` for the new order and default, and split the usage-fetch
  assertion in two: `UsageTab` no longer mounts on arrival, so the fetch must now be proven *absent*
  on mount and *present* after activating the `Usage` row.
- [x] 10.4 Update the `settings-page-shell`, `settings-preferences-tab` and `usage-data-hook` deltas
  plus `docs/architecture.md` for the new order, the new default, and the deferred usage fetch.

**Behaviour change worth noting:** `GET /api/v1/user/usage` is no longer requested when a user opens
`/settings` — only when they select the `Usage` tab. That is a small load reduction, and it means
usage data is fetched later than before.

### Verification

- `npm run test:file -- apps/chat/src/pages/SettingsPage/tests/SettingsPage.spec.tsx`
- Full `apps/chat` Vitest suite

---

## 11. Restore the language group in the user menu

Added after group 10 on explicit request ("`isLanguageGroupShown` — restore, need for feature").
Group 9 had deleted it as dead code once the Settings page became unconditional; it is wanted back
for an upcoming multi-locale feature.

- [x] 11.1 Restore `isLanguageGroupShown` and the `languageGroup` builder in
  `useNavigationMenuGroups`, gated on `!isUserSettingsHidden && SUPPORTED_LANGUAGES.length > 1` —
  the pre-existing rule, with no `settingsPageEnabled` term since that flag no longer exists.
  Restore the `useLanguage` import and the `languageGroup` field on `NavigationMenuGroups`.
- [x] 11.2 Pass `languageGroup` to the desktop `UserMenu` in `Navigation.tsx`. The mobile sheet is
  unchanged — it still gets only `keyboardGroup`.
- [x] 11.3 Update `useNavigationMenuGroups.spec.tsx` and `Navigation.spec.tsx`: the language group is
  present with several locales, absent with one, absent under `HideUserSettings`, and unaffected by
  `HideKeyboardShortcuts`. The keyboard group stays out of the user menu.
- [x] 11.4 Update the `user-menu` and `language-selector` deltas: the locale picker now has **two**
  live surfaces (this menu and the Preferences tab), both writing through the same
  `useLanguage().changeLanguage` so they cannot disagree.

**Known divergence, recorded not fixed:** the submenu keeps its pre-existing
`language.startsWith(code)` prefix match for the active marker, while the Preferences tab compares
base codes. They agree for every locale set that can ship today and differ only if a regional code
(`en-GB`) is ever registered alongside its base (`en`). Converging them is follow-up (e).

### Verification

- `npm run test:file -- apps/chat/src/hooks/navigation/tests/useNavigationMenuGroups.spec.tsx apps/chat/src/components/Navigation/tests/Navigation.spec.tsx`
- Full `apps/chat` Vitest suite

---

## 12. Park the theme selector

Added after group 11 on explicit request ("themes selector — comment — it's for feature"). The row
is finished and correct but has nothing to show while only the light theme ships, so it is commented
out rather than deleted, ready for an upcoming theming feature.

- [x] 12.1 Comment out the theme row in `PreferencesTab` as four blocks each marked
  `THEME SELECTOR`: the header note carrying the parked imports and `THEME_LABEL_KEYS`, the
  `useThemeOptions()` call plus `isThemeRowShown` and `themeOptions`, and the JSX row. Drop
  `isThemeRowShown` from `hasAnyRow`, and remove the `useThemeOptions` / `ThemeId` imports so no
  unused-import lint error appears.
- [x] 12.2 Remove the `theme row` describe block and the `useThemeOptions` mock from
  `PreferencesTab.spec.tsx`, and drop the theme setup from the RTL case (two comboboxes now, not
  three). Removed rather than `skip`ped — a permanently-skipped block rots silently; a comment
  points at where to re-add them.
- [x] 12.3 Rewrite the `settings-preferences-tab` theme requirement as "The theme selector is
  parked, not shipped", recording what must hold while parked and what the row must do when
  re-enabled. Update `docs/architecture.md`.

**Consequence worth naming:** `useThemeOptions` returns to **zero call sites** — the exact state
this change originally set out to fix — and the four `settings.theme*` i18n keys are unused again.
Both are kept deliberately as the parked row's entry points; neither should be deleted as dead code.

### Verification

- `npm run test:file -- apps/chat/src/pages/SettingsPage/PreferencesTab/tests/PreferencesTab.spec.tsx apps/chat/src/pages/SettingsPage/tests/SettingsPage.spec.tsx`
- Full `apps/chat` Vitest suite; `npm run validate:docs`

---

## 13. Cap the preference rows' width

- [x] 13.1 Constrain the `PreferencesTab` rows container with `w-full max-w-md` so the selects stop
  spanning the full pane. On a wide viewport a ~1500px select holding a three-word value read as a
  layout bug; the cap keeps labels and controls in one scannable column.

## 14. Rename "Start chat with" → "Default agent for new chats"

Added on explicit request — the old label was the chat 1.0 wording, carried over but not liked. The
row label collides in wording with its own first option ("Default agent"), which was weighed and
accepted. Identifiers were renamed with it, storage key included.

- [x] 14.1 Rename the user-facing label: `settings.startChatWith` → `settings.defaultAgent` =
  "Default agent for new chats". The two option labels keep their text but move to
  `settings.defaultAgentOptionDefault` / `settings.defaultAgentOptionLastUsed`, named for their role
  rather than repeating the row name.
- [x] 14.2 Rename every identifier: `StartChatWithMode` → `DefaultAgentMode`,
  `useStartChatWithPreference` → `useDefaultAgentPreference`, `StartChatWithSelect` →
  `DefaultAgentSelect`, `isStartChatWithSentinel` → `isDefaultAgentSentinel`, the
  `startChatWith`/`startChatWithRef` locals in `DeploymentsContext`, the
  `isStartChatWithRowShown` flag, and the cross-instance `CustomEvent` name.
- [x] 14.3 Rename the files and folders to match — `types/start-chat-with.ts` →
  `types/default-agent.ts`, `hooks/start-chat-with/` → `hooks/default-agent/`,
  `components/Settings/StartChatWithSelect/` → `DefaultAgentSelect/`, and the spec capability
  `start-chat-with-preference` → `default-agent-preference`. Directory renames had to be done as
  copy-then-delete: the IDE held handles on the originals and both `git mv` and `Rename-Item` were
  refused.
- [x] 14.4 Change the storage key to `StorageKey.DefaultAgent = 'defaultAgent'`, and update every
  spec, doc and prose mention of the old label.

**Breaking for users:** the localStorage key changed, so anyone who had already chosen a value gets
reset to the `LastUsedAgent` default once. That was the accepted cost of renaming the key rather
than leaving it lagging behind the identifiers. The stored *values* (`'default-agent'`,
`'last-used-agent'`) are unchanged.

### Verification

- `npm run test:file -- apps/chat/src/components/Settings/DefaultAgentSelect/tests/DefaultAgentSelect.spec.tsx apps/chat/src/hooks/default-agent/tests/useDefaultAgentPreference.spec.ts apps/chat/src/pages/SettingsPage/PreferencesTab/tests/PreferencesTab.spec.tsx apps/chat/src/context/tests/DeploymentsContext.spec.tsx`
- Full `apps/chat` Vitest suite; typecheck; lint; `validate:docs`

---

## 15. Gate the Default agent row on a pinned agent

Added on explicit request: the control should appear only where the operator pinned a specific agent.

- [x] 15.1 Add `useFeatureFlag('defaultDeploymentPinned')` to `PreferencesTab` and require it for
  `isDefaultAgentRowShown`, alongside the existing `!HideUserSettings` and non-empty-catalog terms.
- [x] 15.2 Mock the flag in `PreferencesTab.spec.tsx` and cover the gate: present when pinned,
  absent when not pinned, absent with an empty catalog, absent under `HideUserSettings` even while
  pinned, and the other rows unaffected in each case.
- [x] 15.3 Update `settings-preferences-tab` (three-part visibility rule + four scenarios),
  `default-agent-preference` (why the pin both offers and loses to the control), and
  `docs/architecture.md`. Decision Log #19 moves from **Open** to **Accepted**, restated as the pin
  offering the control and being outranked by it.

**The apparent contradiction, resolved:** `DEFAULT_DEPLOYMENT_PINNED`'s description says the pin
"takes priority over the user-persisted model preference". That stays true of the *implicit*
preference — `userConfigSelectedId`, the last-used model — which the pin still beats at step 5. It
does not extend to an *explicit* choice made in this control. Pinning is what offers the user the
choice; the explicit choice is what wins. Ordering the two the other way would render the row exactly
when its value is ignored.

**Consequence worth naming:** `defaultDeploymentPinned` defaults to `false`, so in a default
deployment the Preferences tab now shows **only the keyboard-shortcut row** — theme is parked,
language needs a second locale, and the default-agent row needs a pin. The tab is close to empty out
of the box.

### Verification

- `npm run test:file -- apps/chat/src/pages/SettingsPage/PreferencesTab/tests/PreferencesTab.spec.tsx apps/chat/src/pages/SettingsPage/tests/SettingsPage.spec.tsx`
- Full `apps/chat` Vitest suite; typecheck; lint; `validate:docs`

---

## 16. Stop the Default agent row popping in late

Reported after group 15: the control appeared with a visible delay.

**Cause:** two of the row's three visibility terms resolve over the network.
`useFeatureFlag` returns `false` until `AppConfigContext`'s status is `Ready`
(`AppConfigContext.tsx:165`), and `deploymentItems` is empty until the catalog loads. The keyboard
row comes from localStorage and paints immediately, so the default-agent row arrived afterwards and
shifted the layout under it.

- [x] 16.1 Derive `isResolvingRows` in `PreferencesTab` from
  `appConfigStatus === UserConfigStatus.Loading || isDeploymentsLoading`, and hold the body behind a
  `Spinner` (the `UsageTab` pattern) until it clears. The heading and description stay mounted, so
  only the body swaps.
- [x] 16.2 Suppress the empty state while resolving — otherwise "No data" flashes before the rows
  arrive, which is worse than the delay being fixed.
- [x] 16.3 Extend `PreferencesTab.spec.tsx` with a `while row visibility is still resolving` block:
  spinner instead of a partial row set for each of the two loading sources, no empty state while
  resolving, heading stays visible, and the final row set once both settle.
- [x] 16.4 Add `useAppConfig` to `SettingsPage.spec.tsx`'s harness — `PreferencesTab` is now the
  default tab and destructures `status`, so the shared mock (which deliberately has no default
  return) had to be given one. Removed the `useThemeOptions` mock there, dead since the theme row
  was parked.

**Trade-off:** the keyboard row, which needs nothing asynchronous, now also waits. One spinner
resolving into the final layout reads better than rows arriving one at a time — and on navigation
from chat both sources are already loaded, so the spinner only appears on a cold load straight to
`/settings`.

### Verification

- `npm run test:file -- apps/chat/src/pages/SettingsPage/PreferencesTab/tests/PreferencesTab.spec.tsx apps/chat/src/pages/SettingsPage/tests/SettingsPage.spec.tsx`
- Full `apps/chat` Vitest suite; typecheck; lint

## 17. Replace the Default agent `Select` with the deployment selector panel

Reverses Decision 3 as originally shipped (group 4). The flat `Select` mapped the whole catalog into
option nodes for a preference the user sets once, and duplicated the deployment panel's search,
`Highlight`, icon and version rendering in a second place — so this one field opened a picker that
looked nothing like the one the same user opens from the chat input.

**What unblocked it:** the panel's new `extraOptions` input takes non-deployment rows as
`{ id, label }` and renders them as `menuitemradio` rows above every catalog section, with no icon
and no favourite toggle. The original objection — that the two modes would have to be faked as
`CatalogItem`s, the `SPECIAL_DEFAULT_MODEL_DIC` hack from chat 1.0 — no longer applies. The
`extraOptions` contract itself is specified by `deployment-selector-form-trigger`, not here.

- [x] 17.1 Rewrite `DefaultAgentSelect` as a `Label` plus `DeploymentSelectorFieldTrigger`, passing
  `selectedId={preference}`, `onSelect={setPreference}`, `labelledById` from `useId()`, and the two
  modes as `extraOptions`. Dropped from the component: `useDeployments`, `useLanguage`,
  `resolveLocalizedText`, `resolveCatalogIconUrl`, `Highlight`, `DeploymentIcon`, and the
  `searchQuery` state — all of it is the panel's now.
- [x] 17.2 Rewrite `DefaultAgentSelect.spec.tsx` against the trigger's props rather than option
  nodes: the two modes arrive as the picker's pinned rows, the field is labeled and named by the
  rendered label, choosing `Default agent` persists the sentinel, nothing stored resolves to the
  last-used mode, a stored deployment id is handed down as the selected value, and a stored id that
  has left the catalog is preserved.
- [x] 17.3 Update the requirement in `specs/settings-preferences-tab/spec.md` and Decisions 2 and 3
  in `design.md`, which both described the `Select`.

**Also in this group, in the panel rather than this control:** the popup's width cap
(`matchReferenceWidth` only sets a `min-width`, so a long agent name stretched the overlay past its
field) and the `deploymentSelector.currentlySelectedLabel` rename from "My Collection" to "Current
Selected". Both belong to `deployment-selector-form-trigger`/`catalog-model-selector`.

**Left undone:** no real-browser check of the new field — the gap flagged in group 8 still stands.

### Verification

- `npm run test:file -- apps/chat/src/components/Settings/DefaultAgentSelect/tests/DefaultAgentSelect.spec.tsx apps/chat/src/components/DeploymentSelector/tests/DeploymentSelectorPanel.spec.tsx`
- Full `apps/chat` Vitest suite; typecheck; lint
