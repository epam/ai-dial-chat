## Context

`settings-usage-page` shipped `/settings` with a placeholder horizontal `Tabs` (2.0) strip because
the Figma design wasn't available at implementation time. The pasted Figma screenshot (node
1106-189/190, `DIAL 2.0 Concept`) shows a **vertical** sidebar panel: a "SETTINGS" section header,
then icon + label rows (General, Preferences, Usage), with the active row highlighted by a
background fill. Figma API access is still unavailable in this environment (both node IDs returned
"no edit access" from the MCP server) — this design is based entirely on the user-supplied
screenshot, not a live Figma read. Any pixel-level spacing/color details should be re-verified
against the live file during implementation.

## Goals / Non-Goals

**Goals:**
- Match the vertical panel layout from the screenshot: section header + icon/label rows + active
  highlight.
- Extract the panel as a presentational, host-agnostic component in a new `libs/settings-panel`,
  reusable and unit-testable without `apps/chat` routing/i18n/data concerns.
- Add `General` and `Preferences` as visible, disabled rows so the layout matches the design without
  building unrelated functionality.
- Full keyboard/screen-reader support for the panel, matching the interaction quality of the
  `Tabs` (2.0) component it replaces.

**Non-Goals:**
- Any real General/Preferences content, route, or data.
- Changing `useUsageData`, the backend, or `UserMenu`.
- Fixing the `@nx/enforce-module-boundaries` wildcard gap (documented, not remediated here).

## Decisions

### 1. Hand-roll the panel in a new lib rather than reusing `DialTabs`' vertical orientation
`DialTabs` (1.0) supports `orientation={TabOrientation.Vertical}`, so it was considered first per
the "component-first" rule. It was rejected because its `TabModel` has no per-item icon slot and no
section-header concept — the Figma layout needs both, and `DialTabs` is a superseded 1.0 component
besides (`Tabs` 2.0 has no replacement vertical mode). Building a small bespoke component is the
correct call here, matching the `search-results-highlight.md` precedent: "if a call site's UI
genuinely can't fit an existing component's API, that's a gap — don't force-fit it."
*Alternative rejected*: extend the app-owned `SettingsPage` in place instead of a new lib. Rejected
per the user's explicit ask for a reusable lib component, and because the component is fully
presentational (no host coupling), which is exactly the isolation boundary `libs/*` exists for.

### 2. Lib scaffold matches `libs/share`, not `libs/conversation-input`
Research found `libs/conversation-input` tagged `"publishable"` (not `"type:ui"`) and peer-depends
on a second lib (`attachment-input`) — a looser pattern than the isolation goal here.
`libs/share`/`libs/prompts`/`libs/prompt-editor` are tagged `"type:ui"` and peer-depend on
`react`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`, `@tabler/icons-react` only — that is
the reference this lib follows: `"tags": ["type:ui"]`, peer deps limited to those four.
**Caveat**: `eslint.config.mjs`'s `@nx/enforce-module-boundaries` currently has
`{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }` — a wildcard that does not actually enforce
"`type:ui` → `chat-shared` only" at lint time. This lib still follows the convention (it is
correct isolation regardless of whether lint catches a violation), but a reviewer should not expect
ESLint to catch a future accidental dependency on `apps/chat` or another lib here — that gap is
called out for awareness, not fixed in this change.

### 3. Props shape: icons and labels are host-supplied, no i18n/data inside the lib
```ts
export interface SettingsPanelItem {
  /** Stable identifier, matched against `activeId`. */
  id: string;
  /** Already-localized row label. */
  label: string;
  /** Row icon, rendered before the label. */
  icon?: ReactNode;
  /** Disabled rows render dimmed, are unclickable, and are skipped by keyboard navigation. */
  disabled?: boolean;
}
export interface SettingsPanelProps {
  items: SettingsPanelItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Already-localized header text above the item list (e.g. "Settings"). Optional — omit to render no header. */
  sectionLabel?: string;
  /** CSS class applied to the section header. Defaults to `'dial-tiny-lead-semi-text'` (auto-uppercases; pass the label sentence-case). */
  sectionLabelClassName?: string;
}
```
`SettingsPage` (`apps/chat`) resolves `label` via `useTranslation`, `icon` via a chosen
`@tabler/icons-react` icon per row, and keeps `activeId`/`onSelect` wired to its existing
`useState`. This mirrors `useSettingsTabConfig`'s current job of building `TabItem[]` for the old
`Tabs` component — it now builds `SettingsPanelItem[]` instead, including the two disabled entries.
*Icon choices (app-layer, not lib concern)*: `IconLayoutGrid` for Usage (matches the grid glyph in
the screenshot), `IconUser` for General, `IconAdjustmentsHorizontal` for Preferences — none of
these were previously used elsewhere in `apps/chat/src` for this exact meaning (`IconUser` is used
for "Profile" in `NavPageContent.tsx`, close enough semantically to "General account" to reuse
rather than picking a fourth arbitrary icon). Confirm against the live Figma file during
implementation.

### 4. Accessibility: vertical ARIA tablist, following the `Tabs` (2.0) interaction contract
The panel behaves like tabs (exactly one panel visible, switched without navigation), so it follows
the same "automatic activation" ARIA tabs pattern `Tabs` (2.0) already implements, adapted to
vertical orientation: `role="tablist" aria-orientation="vertical"` on the list,
`role="tab" aria-selected` per row, only the active tab in the tab order (`tabIndex={0}` on active,
`-1` on the rest), `ArrowUp`/`ArrowDown` move focus *and* selection (not `ArrowLeft`/`ArrowRight`,
since the ui-kit's horizontal `Tabs` uses those), `Home`/`End` jump to the first/last enabled row,
and disabled rows (`General`, `Preferences`) are `aria-disabled`, unclickable, and skipped by arrow
navigation — matching `Tabs` 2.0's documented disabled-tab behavior.

### 5. `SettingsPage` keeps owning state; the panel stays a pure view
No change to decision #2/#3 from `settings-usage-page`'s design (tab state lives in
`useState<SettingsTabs>` inside `SettingsPage`, no Context). Swapping the rendered component from
`Tabs` to the new panel is a one-line change plus an adapter that maps `useSettingsTabConfig`'s
output shape to `SettingsPanelItem[]`.

## Risks / Trade-offs

- **[Risk]** Building bespoke ARIA tablist keyboard handling duplicates logic the ui-kit's `Tabs`
  (2.0) already has (just for the wrong axis). → **Mitigation**: keep the interaction code in one
  small, well-tested hook/utility inside the new lib (e.g. `useVerticalTablistKeyboard`) so it's a
  single reviewable unit, not scattered inline handlers; consider proposing a `verticalOrientation`
  prop upstream to `Tabs` (2.0) in the ui-kit as a longer-term dedup, out of scope here.
- **[Risk]** Screenshot-only design source (no live Figma access) means spacing/colors/icon choices
  are best-effort. → **Mitigation**: flagged explicitly for a design QA pass before merge; icon
  choices are easy to swap since they're app-layer props, not baked into the lib.
- **[Risk]** Adding a `libs/settings-panel` for a single current consumer might look like premature
  extraction. → **Mitigation**: this was an explicit user request (not a speculative abstraction),
  and the component has zero host coupling — the isolation cost of keeping it in `apps/chat` instead
  would be purely organizational, not architectural.

## Migration Plan

Additive/replacement within the still-unarchived `settings-usage-page` surface: no persisted state,
no route change, no backend change. Rollback is a revert; git history retains the previous
`Tabs`-based `SettingsPage.tsx`.

## Open Questions

- Exact icon glyphs, spacing, and color tokens should be confirmed against the live Figma file once
  access is available — the ones proposed here are best-effort reads of the screenshot.
- Should `General`/`Preferences` disabled rows carry a tooltip ("Coming soon") or render with no
  extra affordance? Not specified in the screenshot; defaulting to no tooltip (plain disabled
  state) unless product asks otherwise.
