## Context

Four preferences, three current homes, one of them nonexistent:

| Preference | Today's surface | Today's storage |
| --- | --- | --- |
| Theme | none — `useThemeOptions` has zero call sites; `TODO` at `useNavigationMenuGroups.tsx:15-18` | `StorageKey.Theme`, via `ThemeContext.setTheme` |
| Language | `UserMenu` submenu, desktop only, hidden while one locale ships | `i18nextLng` (i18next language detector's own key, not in `StorageKey`) |
| Keyboard shortcut | `UserMenu` submenu + mobile `NavigationSheet` | `StorageKey.KeyboardShortcut`, via `useKeyboardShortcutPreference` |
| Default agent for new chats | none — deleted in `fba0914817` with the rest of chat 1.0 | — |

The Settings page shell is already built for this: `SettingsPage.tsx` reads `items` and
`tabComponents` from `useSettingsTabConfig()` and renders `tabComponents[activeTab]`, and the hook
carries an explicit comment that "adding a future tab is one new entry here, with no change to
SettingsPage's rendering logic" (`useSettingsTabConfig.tsx:21-24`). So the container work is
genuinely one enum member and one array entry; all the design weight is in the four rows and in the
one preference that does not yet exist.

Three constraints shape every decision below.

**C1 — ~~`settingsPageEnabled` defaults to `false`~~ — withdrawn.** This constraint originally read:
"`config-registry.constants.ts` declares it off by default, and `app.tsx` redirects `/settings` to
root when it is off. A change that moves a working preference into a surface that most deployments
cannot reach is a regression, not a move."

**The flag has since been removed entirely** (see Decision 7), so the Settings page is always
reachable and the constraint no longer binds. It is kept here, struck through, because Decision 1
below was shaped by it and reads as over-engineered without it.

**C2 — mobile has no Settings entry point.** `Navigation.tsx` renders `UserMenu` (which owns the
Settings item) only in the `!isMobile` branch; the mobile `NavigationSheet` at lines 114-134 is
passed `profile`, `groups`, `onLogout` and `footer`, but no `onSettings`. `libs/navigation-panel`'s
sheet has no Settings affordance to pass one to.

**C3 — `DeploymentsContext` already owns new-chat deployment resolution, and its callbacks are
deliberately ref-based.** `resolveInitialSelection` (`DeploymentsContext.tsx:151-170`) is the single
precedence function, called from both the post-fetch effect (line 318) and `restoreDefaultSelection`
(line 536). `restoreDefaultSelection` reads `itemsRef`, `userConfigSelectedIdRef`,
`isDefaultDeploymentPinnedRef` and `defaultDeploymentIdRef` rather than the values themselves, with
a comment (lines 459-465) explaining that a stable callback identity is load-bearing: it is called
from `ConversationRoute`'s mount effect, and a changing identity would re-fire that effect on every
deployments refetch and discard the user's just-made selection. Any new input to the precedence
chain has to arrive the same way or that guarantee breaks.

## Goals / Non-Goals

**Goals:**

- One reachable home for all four preferences, added through the shell's intended extension point.
- Give `useThemeOptions` and the four dormant `settings.theme*` i18n keys their first call site.
- Reinstate chat 1.0's `Default agent` / `Last used agent` / specific-agent semantics with the same
  three-way meaning, on chat 2.0's own state plumbing.
- Preserve every current behaviour for builds where `settingsPageEnabled` is off, and for mobile.
- Keep the change backend-free: no endpoint, no DTO, no OpenAPI regeneration, no generated-client
  rebuild.

**Non-Goals:**

- A Settings entry point in the mobile navigation sheet. It needs a `libs/navigation-panel` prop
  addition and a mobile layout for the tab shell (`SettingsPage` hardcodes a `w-[240px]` rail beside
  the pane) — a separate change, and the reason the mobile keyboard group stays put here.
- Registering a second locale, or serving a dark theme from the backend. Both selectors are built to
  appear the moment their data arrives; neither is made to appear by this change.
- Moving any preference to the server-side `.client_data/.user-config.json`. Explicitly chosen
  against for `Default agent for new chats` in Decision 4.
- Per-tab URL routing (`/settings?tab=preferences`). `activeTab` stays component-local `useState`,
  as the shell has it today.

## Decisions

### Decision 1 — The `UserMenu` groups are removed *unconditionally*

**Superseded by Decision 7.** With the flag gone, there is no "flag off" world to preserve the
submenus for, so the conditional machinery below was deleted: `useNavigationMenuGroups` no longer
reads `useFeatureFlag`, no longer returns `languageGroup`, and no longer needs the surface-named
third field — it returns a single `keyboardGroup` for the mobile sheet, and `Navigation` passes
`UserMenu` no `groups` at all. The reasoning below is retained because it records *why* the
conditional version existed and what the alternatives were.

#### Original decision (conditional, gated on `settingsPageEnabled`)

`useNavigationMenuGroups` keeps building both groups, but each gains one more suppression term: the
Settings page not being available. `Navigation.tsx` then passes `groups={[]}` (which `UserMenu`
already handles — `openspec/specs/user-menu/spec.md` specifies that a host supplying no groups
yields `identity → divider → [settings] → logout`).

Rationale: this is the only reading of "move it to the Preferences tab" that does not regress C1.
With the flag off there is no Preferences tab, so the submenus must stay; with it on, they are
duplicate surfaces for the same state and the tab is the better one.

The gate lives in `useNavigationMenuGroups` rather than at the `Navigation.tsx` call site because
the hook already owns every other suppression rule for these groups (`HideUserSettings`,
`HideKeyboardShortcuts`, `SUPPORTED_LANGUAGES.length > 1`) and is where a reader looks for "why is
this row missing". `Navigation.tsx` already reads `settingsPageEnabled`, so the hook reading it too
is not a new dependency for the module.

- *Alternative A — unconditional removal.* Rejected on C1: every default deployment would lose the
  keyboard preference outright, and the language preference's only surface, for a page they cannot
  open.
- *Alternative B — keep both surfaces permanently.* Rejected: it is what the request asked to stop
  doing, and two live surfaces over `useKeyboardShortcutPreference` means two places to keep in sync
  when the option set changes. (It is, however, the safe fallback if Decision 1 proves noisy — the
  gate is one boolean.)
- *Alternative C — gate on the flag at the `Navigation.tsx` call site.* Equivalent behaviour,
  rejected only on locality: it splits these groups' visibility rules across two files.

**Mobile stays as-is** (C2): `NavigationSheet` keeps `groups={keyboardGroup ? [keyboardGroup] : undefined}`.
Since the sheet's group now also depends on the flag, the existing comment at `Navigation.tsx:121-123`
needs rewording, and the mobile branch needs the *ungated* keyboard group. That means
`useNavigationMenuGroups` returns both: the gated pair for the desktop menu and an ungated
`keyboardGroup` for the sheet. Concretely the hook's return type grows to
`{ languageGroup?, keyboardGroup?, mobileKeyboardGroup? }` — named for the surface, because the
difference between them is exactly which surface they are for, not what they contain.

### Decision 2 — One `PreferencesTab` component; the finite-set rows are plain `Select`s, and the tab owns the visibility rules

The tab renders up to four rows. The three finite-set rows (Theme, Language, Keyboard shortcut) are
each a ui-kit 2.0 `Select` (`@epam/ai-dial-ui-kit`) with a visible label via `labelProps`; the
`Default agent for new chats` row is the deployment selector trigger instead, because its list is
the whole catalog rather than a finite set (Decision 3). Row visibility, per the "hide when single
option" decision:

| Row | Renders when |
| --- | --- |
| Theme | `useThemeOptions().themes` has ≥ 2 entries **and** `!HideUserSettings` |
| Language | `SUPPORTED_LANGUAGES.length > 1` **and** `!HideUserSettings` |
| Keyboard shortcut | `!HideUserSettings && !HideKeyboardShortcuts` |
| Default agent for new chats | `!HideUserSettings` **and** the deployments catalog is non-empty |

With today's data that is two rows (Keyboard, Default agent for new chats). If every row is suppressed the tab
renders the shared empty state rather than a bare heading — an overlay host with
`HideUserSettings` on can reach this.

`Select` over `Radio`/`RadioGroup` for the finite-set rows: a value picker from a named finite set
is `Select`'s documented purpose. `Default agent for new chats`'s list is unbounded (every
deployment), so neither a radio group nor a finite-set `Select` fits it — that row gets the
deployment selector trigger (Decision 3). Both controls are field-shaped with a visible label and a
chevron, so the tab still reads as one coherent column rather than mixing a radio group with a
dropdown.

`Select` over `Menu`: a menu's selected-state convention is a trailing check for *actions*; these
are values, so `Select` is correct. (This is also why the rows are not simply the existing
`NavigationMenuGroup` values re-rendered — those model menu options, `{ id, label, isActive, onSelect }`,
not field values.)

Theme option labels come from the existing `settings.themeLight` / `themeDark` / `themeSystem` keys
keyed off `ThemeId`, not from the server's `displayName`, so a theme's label stays translated. A
served theme whose id is not a `ThemeId` member falls back to its own `displayName`.

- *Alternative — a `PreferenceRow` wrapper component per row.* Rejected as premature: four rows in
  one file, each 5-15 lines of `options` construction, is more readable than four files plus a
  shared wrapper. `DefaultAgentSelect` is the one exception, extracted because it has real logic
  (Decision 3).

### Decision 3 — `Default agent for new chats` reuses the deployment selector panel

`DefaultAgentSelect` is its own component under `apps/chat/src/components/Settings/`. It renders a
`Label` plus a `DeploymentSelectorFieldTrigger`, and supplies the two chat-1.0 modes through that
trigger's `extraOptions` prop. It builds no option list of its own: no icons, no `Highlight`, no
`searchQuery` state, no `resolveLocalizedText` call. The panel owns all of it, so the preference is
picked the way an agent is picked everywhere else and the control never materialises one option
node per deployment.

**This reverses the decision this change originally shipped**, which was a searchable `Select`
whose option list was `[Default agent, Last used agent, ...deployments]`, each deployment option
carrying its own `icon` / `labelNode` (`Highlight`) / `rightControl` (version) / plain `label`. That
version is gone; the requirement in `specs/settings-preferences-tab/spec.md` describes the trigger.

The original objection to reusing the panel was that the two modes "would have to be faked as
catalog items — exactly the `SPECIAL_DEFAULT_MODEL_DIC` hack chat 1.0 needed, where a fake
`DialAIEntityModel` was pushed through the model list". `extraOptions` is what removed that
objection: the panel now takes non-deployment rows as a first-class input (`{ id, label }`, no
`CatalogItem` shape), renders them as `menuitemradio` rows above every catalog section without icon
or favourite toggle, and filters them by the panel's own search. No fake entity is constructed, and
the mode ids flow through `selectedId`/`onSelect` exactly as a deployment id does. What is left of
the original objection — that the panel carries chat-composer concerns (pinned item, Current
Selected sectioning) — costs nothing here, because those sections simply render for this field too.

The old `DefaultModelSelect`'s `indexSeparator` divider between the modes and the catalog is still
not reproduced: the panel's section headings already separate the mode rows from Current Selected
and Favorites.

- *Alternative — keep the flat `Select`.* Rejected: it mapped the entire catalog into option nodes
  on every render for a preference the user sets once, duplicated the panel's search, `Highlight`,
  icon and version rendering in a second place, and gave this one field a picker that looks nothing
  like the one the same user opens from the chat input.

### Decision 4 — The preference is a localStorage string with a three-case grammar, keyed by `StorageKey.DefaultAgent`

```
StorageKey.DefaultAgent  →  'default-agent' | 'last-used-agent' | '<deploymentId>'
```

A `DefaultAgentMode` string enum (`apps/chat/src/types/default-agent.ts`) names the two sentinel
values; anything else is read as a deployment id. `'default-agent'` and `'last-used-agent'` are
carried over verbatim from chat 1.0's `DEFAULT_AGENT` / `LAST_USED_AGENT` constants, so a user
migrating from a chat 1.0 deployment sees a familiar value if the keys are ever bridged.

`useDefaultAgentPreference` mirrors `useKeyboardShortcutPreference` exactly — same file shape, same
`{ preference, setPreference }` return, same `window` `CustomEvent` for cross-instance sync. The
event matters for the same reason it does there: `DeploymentsContext` and the Preferences tab are
both mounted, and the context must see a change made in the tab without a reload.

localStorage over the server-side user-config file: the three preferences it sits beside (theme,
keyboard, language) are all localStorage, so it matches its neighbours; and the alternative costs a
`.user-config.json` v3 shape, a migration path, a new `PATCH` route with Swagger annotations, an
`npm run openapi` regeneration, a `chat-api-client` rebuild and a `UserConfigContext` field — for a
preference whose value is a display default, not data. The trade-off is that it does not follow the
user across browsers; that is accepted and stated in Risks.

**Default: `DefaultAgentMode.LastUsedAgent`.** This is exactly today's behaviour
(`resolveInitialSelection` prefers `userConfigSelectedId`), so no existing user's new-chat model
changes when this ships. The screenshot shows `Default agent` highlighted, but that is chat 1.0's
own default, and adopting it here would silently repoint every existing user's new chats at the
operator default.

### Decision 5 — `restoreDefaultSelection` gains one precedence step, delivered by ref

`resolveInitialSelection` grows a parameter and the precedence becomes:

```
1. inMemoryId                      (unchanged — an explicit in-session pick wins)
2. defaultAgent is a deployment id and that deployment exists   → it        [NEW]
3. defaultAgent === DefaultAgent  → operatorDefaultId, if it exists         [NEW]
4. operatorDefaultId, when pinned  (unchanged)
5. userConfigSelectedId            (unchanged — this is the LastUsedAgent path)
6. deployments[0]                  (unchanged)
```

`LastUsedAgent` needs no branch of its own: it is the absence of steps 2-3, falling through to
step 5, which is what "last used" already means. `DefaultAgent` gets step 3 rather than reusing
step 4 because step 4 is additionally gated on the `defaultDeploymentPinned` feature flag — a user
who explicitly asks for the operator default should get it whether or not the operator pinned it.

Step 2 sits above the operator default so an explicit per-agent choice is not overridden by a pinned
operator default. This is the one genuine behaviour conflict in the change: with
`defaultDeploymentPinned` on, an operator is asserting a default, and a user naming a specific agent
is contradicting it. Resolving it toward the user matches the control the tab implies — a picker
whose value is silently ignored is worse than no picker. If an operator needs the pin to be
absolute, that is a separate requirement on the pin, not on this preference.

Per C3, the value reaches `restoreDefaultSelection` through a `defaultAgentRef` kept current by an
effect, alongside the four refs already there — never through the callback's dependency array, which
must stay `[]`.

**Correction found during implementation:** there are **three** `resolveInitialSelection` call sites,
not the two this decision originally named. The third is the late-config re-resolution effect
(guarded by `selectionExplicitlySetRef.current || rawDeployments.length === 0`), which re-resolves a
provisional selection once user/app config arrives after the catalog. It runs *after*
`loadDeployments`, so missing it leaves both new precedence steps dead on first load — which is
exactly how it surfaced, as two red tests in the risk-first slice. It is a dependency-driven effect
rather than a stable callback, so it takes the live preference value and lists it as a dependency:
the ref discipline above applies only to `restoreDefaultSelection`, whose identity a consumer's
effect depends on.

A second, smaller correction: the existing `operatorDefaultId` parameter is already the
*pinned-only* value (both callers pass `isPinned ? defaultId : null`), so step 3 — which must ignore
the pin — needs the raw configured default as well. The function therefore takes two distinct
parameters, `pinnedDefaultId` and `configuredDefaultId`, and the pre-existing one was renamed so the
two cannot be confused at a call site.

- *Alternative — resolve the preference in `ConversationRoute` and call `restoreSelectedItemId`.*
  Rejected: it would put deployment-precedence logic in a route component and bypass the post-fetch
  effect at line 318, so the preference would apply on navigation but not on first load.

### Decision 6 — Tab icon, placement, and a11y

`IconAdjustmentsHorizontal` (`@tabler/icons-react`) at `DIAL_ICON_SIZE.MD` with
`stroke={DIAL_KIT_ICON_STROKE}` and `aria-hidden`, matching the `Usage` entry's shape exactly.
`Preferences` is placed **after** `Usage`, so `SettingsTabs.Usage` stays the `useState` initial value
and the shell's "Usage is selected by default" behaviour is untouched.

The tab inherits the shell's a11y: `SettingsPanel` owns the vertical tablist, and each `Select`
carries its own accessible name through `labelProps.label`. The one new a11y obligation is the
tab's own heading — `<h2>` matching `UsageTab.tsx:103`, under the shell's `sr-only` `<h1>`.

RTL: layout is a vertical stack with logical spacing only (`gap-*`, `px-*` are direction-agnostic;
any one-sided spacing uses `ps-*`/`pe-*`). No directional icons, so nothing to mirror.

### Decision 7 — The `settingsPageEnabled` flag is removed end to end

The Settings page ships on, for everyone. Removed: the `features.settingsPageEnabled`
config-registry entry, `FeatureKey.SettingsPageEnabled`, and the `SETTINGS_PAGE_ENABLED` /
`SETTINGS_PAGE_ENABLED_ROLES` environment variables, plus all four frontend read sites
(`app.tsx`'s route guard, `Navigation.tsx`'s Settings entry, `useNavigationMenuGroups`' gating, and
`UsageTab`'s `useUsageData` argument).

This is the standard "graduate the flag" operation: the page and its two tabs are finished, so the
kill switch is now just a branch nobody takes. It reverses the archived
`2026-08-19-gate-settings-page-feature-flag` change, which introduced the flag while the page was
still a one-tab placeholder.

Three consequences worth naming:

- **Decision 1 collapses.** Its whole conditional structure existed to satisfy C1. With the flag
  gone the desktop submenus are dead code in every configuration, so `languageGroup` and the
  surface-named `mobileKeyboardGroup` field are deleted and the hook returns one field.
- **`UsageTab` drops its `enabled` argument** rather than passing `true`. `useUsageData`'s
  `enabled` parameter stays — it is a host-agnostic lib contract with a `true` default — but the
  tab has nothing meaningful to pass: mounting it is the signal.
- **Operators lose a switch.** `SETTINGS_PAGE_ENABLED` and `SETTINGS_PAGE_ENABLED_ROLES` are no
  longer read. A deployment that set either to keep the page hidden, or to restrict it by role, will
  silently get the page for all users on upgrade. This is the one genuinely breaking part of the
  change and belongs in release notes.

- *Alternative — default the flag to `true` and keep it.* Rejected: it preserves the role-restriction
  capability and the kill switch, but keeps four read sites and a config entry alive for a feature
  with no remaining rollout risk, and leaves Decision 1's conditional machinery in place. Worth
  revisiting only if an operator actually needs per-role Settings access, which would be a new
  requirement rather than a restoration.
- *Alternative — remove the frontend reads but keep the env vars as no-ops.* Rejected: a variable
  that is read but ignored is worse than one that is gone, because it looks like it still works.

## Risks / Trade-offs

- **An operator who set `SETTINGS_PAGE_ENABLED=false`, or restricted it by role, silently gets the
  page for everyone on upgrade** → Accepted and deliberate (Decision 7), but it is a breaking
  configuration change and needs a release note. There is no migration: the switch is gone.
- **An operator who wanted the old menu shortcuts loses them** → No longer revertible by a flag;
  restoring them means re-adding the group builders. Called out so the cost is known.
- **Mobile keeps the keyboard preference but gains no theme, language or `Default agent for new chats` row**
  → Accepted, per C2 and Non-Goals. Mobile is no worse off than today (it has never had the other
  three); the gap closes when the sheet gets a Settings entry point. Worth recording as a follow-up
  so it is not mistaken for an oversight.
- **`Default agent for new chats` does not follow the user across browsers or devices** → Accepted
  (Decision 4). The migration path if this proves wrong is additive: move the same three-case string
  into the user-config file and have the hook prefer the server value, with the localStorage entry as
  the fallback. The value grammar is chosen to survive that move unchanged.
- **A named deployment is later deleted from the catalog** → Step 2 of the precedence requires the
  deployment to exist in `items`, so a stale id falls through to the operator default and then to
  last-used — the user gets a working chat, not a dead selection. The stale entry is *not* cleaned
  up from localStorage, so the row shows its "no longer available" state and the choice comes back
  if the deployment returns. The trigger must therefore tolerate a `selectedId` matching neither a
  mode nor a loaded deployment; its label-resolution fallback displays the raw id.
- **Step 2 outranking a pinned operator default** → The deliberate conflict resolution in
  Decision 5, flagged as the one place this change alters an operator-facing guarantee. If it is
  wrong for a deployment, the fix is a gate on the pin, not on the preference.
- **The Preferences tab can render with every row hidden** → Handled with the shared empty state
  rather than an empty pane (Decision 2).
- **Two tabs flip `SettingsPanel`'s `isVisuallyActive = isActive && items.length > 1` guard on for
  the first time** → Not a defect: the guard exists precisely so a one-row panel does not highlight
  a row the user cannot change. It should be verified visually once, and the shell delta should note
  that the active-row highlight now appears.
- **`useNavigationMenuGroups`'s return type grows a third, surface-named field** → Slightly awkward,
  and the honest cost of Decision 1 + C2. The alternative — a parameter such as
  `useNavigationMenuGroups({ isGated })` called twice — trades an awkward field for two hook calls
  doing duplicate work; the field is the lesser cost.

## Migration Plan

No data migration, but **this is no longer a dark launch**. Decision 7 removes the
`settingsPageEnabled` flag, so every deployment gets the change on the release that carries it, and
the backend must deploy too (the config-registry entry, feature-key member and two environment
variables are gone).

Visible deltas for every deployment, not just ones that opted in:

- the Settings entry appears in the avatar dropdown for all authenticated users;
- `/settings` resolves instead of redirecting to root;
- the Settings rail gains a `Preferences` row, and its active row is now visibly highlighted;
- the Language and Keyboard submenus disappear from the avatar dropdown.

**Operator action required:** `SETTINGS_PAGE_ENABLED` and `SETTINGS_PAGE_ENABLED_ROLES` are no
longer read. A deployment relying on either to hide or role-restrict the page must know that it no
longer can. This belongs in the release notes.

Rollback is a plain revert of both apps. The only residue is an orphaned `defaultAgent`
localStorage entry per user, which nothing reads after the revert and which is picked up again if
the change re-lands.

## Open Questions

None blocking. Two deferred, both recorded above rather than left implicit:

1. Should the mobile navigation sheet get a Settings entry point, making the tab reachable on mobile
   and letting the keyboard group leave the sheet? Deferred to its own change (Non-Goals); needs a
   `libs/navigation-panel` prop and a mobile layout for `SettingsPage`'s fixed-width rail.
2. Should a pinned operator default (`defaultDeploymentPinned`) be able to override a user's
   explicit `Default agent for new chats` agent? Decided toward the user for now (Decision 5), and isolated to
   one ordering step so it can be reversed without touching anything else.
