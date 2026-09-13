## Why

User preferences are scattered and partly unreachable. Language and Keyboard-shortcut pickers
live as submenus of the desktop `UserMenu` dropdown (`apps/chat/src/hooks/navigation/useNavigationMenuGroups.tsx:41-94`),
the Theme picker does not exist at all — only a `TODO` at `useNavigationMenuGroups.tsx:15-18` and an
orphaned `useThemeOptions` hook (`apps/chat/src/hooks/theme/useThemeOptions.ts`) with zero call
sites, plus four unused i18n keys (`settings.theme`, `settings.themeLight`, `settings.themeDark`,
`settings.themeSystem` — `apps/chat/src/i18n/locales/en.json:608-611`) — and the chat-1.0
"Default agent for new chats" agent-default selector was dropped in the 2.0 rewrite (`fba0914817` deleted
`apps/chat/src/components/Settings/DefaultModelSelect.tsx`) and never reinstated.

Meanwhile the Settings page shipped with a deliberately extensible tab container and exactly one
tab (`SettingsTabs.Usage`); `openspec/specs/settings-page-shell/spec.md` records that a
`Preferences` row was evaluated and removed before shipping because there was nothing to put in
it. There is now something to put in it, and a dropdown submenu three levels deep in an avatar
menu is the wrong home for four unrelated preferences.

## What Changes

- **New `Preferences` tab on the Settings page**, added the way the shell was designed for: one new
  `SettingsTabs` enum member plus one entry in `apps/chat/src/hooks/useSettingsTabConfig.tsx`. No
  change to `SettingsPage`'s rendering logic or to the `/settings` route.
- **Theme selector** — the first UI for `useThemeOptions`, rendered with the ui-kit 2.0 `Select`
  over the themes the backend serves (`GET /api/v1/themes`), writing through
  `useTheme().setTheme` (already persists to `StorageKey.Theme`). Hidden while fewer than two
  themes are available.
- **Language selector** — same control over `SUPPORTED_LANGUAGES`, writing through
  `useLanguage().changeLanguage`. Hidden while `SUPPORTED_LANGUAGES.length <= 1`, preserving
  today's rule, so it renders nothing until a second locale is registered.
- **Keyboard-shortcut selector** — Enter vs. `⌘/Ctrl`+Enter, over the existing
  `useKeyboardShortcutPreference` hook. No change to the preference's storage or to the chat
  input's behaviour.
- **"Default agent for new chats" selector** — the chat-1.0 `DefaultModelSelect` behaviour, reinstated: a
  searchable agent picker whose list is `Default agent`, `Last used agent`, then every deployment
  in the catalog with its icon and version. Backed by a **new localStorage preference**
  (`StorageKey.DefaultAgent`) and consumed by `DeploymentsContext.restoreDefaultSelection`, which
  is already the single funnel the new-chat screen calls on mount.
- **BREAKING (UX, not API): the Language and Keyboard submenus are removed from the desktop
  `UserMenu`** — `Navigation.tsx` stops passing `groups` to it entirely. With the
  `settingsPageEnabled` flag removed (below), the Settings page is always reachable, so the removal
  is unconditional and `useNavigationMenuGroups` drops its `languageGroup` field outright. The
  mobile `NavigationSheet` keeps its keyboard group — mobile has no Settings entry point
  (`Navigation.tsx` passes it no `onSettings`), so removing it there would strand mobile users.

Not in scope: adding a Settings entry point to the mobile navigation sheet; registering a second
locale; adding a dark theme to the backend theme config; moving any preference from localStorage to
the server-side user-config file.

## Capabilities

### New Capabilities

- `settings-preferences-tab`: the `Preferences` tab itself — its registration in the tab config, the
  four rows it renders, each row's visibility rule, the hooks each row reads and writes, and the
  tab's a11y/RTL/i18n contract.
- `default-agent-preference`: the new `Default agent` / `Last used agent` / specific-agent
  preference — its localStorage key and value grammar, its default, its cross-instance sync, and how
  `DeploymentsContext` resolves a new chat's deployment from it.

### Modified Capabilities

- `settings-page-shell`: the "Extensible tab container" requirement currently asserts the
  `SettingsTabs` enum "SHALL contain exactly one member, `Usage`" and that `Preferences` "were
  removed entirely (no enum member, no config entry, no i18n keys)". Both statements become false.
- `user-menu`: the "Preference groups are supplied by the host" requirement ("Two groups exist
  today") and the "Theme selection is not offered in the user menu" requirement (which points at the
  `TODO` this change deletes) both change. `Menu item order` gains the no-groups case as the
  normal desktop shape.
- `language-selector`: the requirement that the selector's only surface is a `UserMenu`
  `NavigationMenuGroup` built by `useNavigationMenuGroups` changes — the Preferences tab becomes its
  home. The persistence, immediate-application and RTL-direction requirements are unaffected.
- `keyboard-shortcut-preference`: the surface that writes the preference moves. The storage key,
  value grammar, default, cross-instance-sync guarantee and chat-input behaviour are unaffected.
- `conversation-deployment-selection`: the "New Chat screen restores the user's default deployment
  on mount" requirement gains a precedence step — `restoreDefaultSelection` must consult the new
  `Default agent for new chats` preference before falling back to today's
  operator-default → user-config → first-item chain.

## Impact

**Frontend (`apps/chat`) — new files**

- `src/pages/SettingsPage/PreferencesTab/PreferencesTab.tsx` + `tests/`
- `src/components/Settings/DefaultAgentSelect/DefaultAgentSelect.tsx` + `tests/`
- `src/hooks/default-agent/useDefaultAgentPreference.ts` + `tests/`
- `src/types/default-agent.ts` (the `DefaultAgentMode` string enum)

**Frontend — modified**

- `src/types/settings-tabs.ts` — `Preferences = 'preferences'`
- `src/hooks/useSettingsTabConfig.tsx` — one entry, `IconAdjustmentsHorizontal`
- `src/types/storage-key.ts` — `DefaultAgent = 'defaultAgent'`
- `src/hooks/navigation/useNavigationMenuGroups.tsx` — delete the theme `TODO`; gate both groups
  on the Settings page being unavailable
- `src/components/Navigation/Navigation.tsx` — stop passing `groups` to `UserMenu` when
  `settingsPageEnabled`
- `src/context/DeploymentsContext.tsx` — `resolveInitialSelection` / `restoreDefaultSelection`
  consult the new preference
- `src/constants/translation-keys.ts` + `src/i18n/locales/en.json` — five new `settings.*` keys
  (`preferences`, `preferencesDescription`, `defaultAgent`, `defaultAgentOptionDefault`,
  `defaultAgentOptionLastUsed`). The agent-search placeholder reuses the existing
  `deploymentSelector.searchPlaceholder` rather than duplicating its English string.

**Contracts unchanged**

No backend change, no new endpoint, no DTO change, no `npm run openapi` run, no generated-client
rebuild, no `libs/*` change. `libs/settings-panel` is consumed as-is — the tab list grows from one
row to two, which also flips its `isVisuallyActive = isActive && items.length > 1` guard
(`libs/settings-panel/src/components/SettingsPanel/SettingsPanel.tsx:120`) on for the first time, so
the active row becomes visibly highlighted. That is a latent behaviour the existing lib spec already
describes; it needs no lib edit, only a note in the shell delta.

**Feature gating**

**The `settingsPageEnabled` flag is removed entirely** — the Settings page ships on, for everyone.
That means deleting the `features.settingsPageEnabled` config-registry entry, the
`FeatureKey.SettingsPageEnabled` enum member, and the `SETTINGS_PAGE_ENABLED` /
`SETTINGS_PAGE_ENABLED_ROLES` environment variables. **BREAKING for operators** who set either
variable: they are no longer read, and the page can no longer be switched off or restricted by role.
This reverses the archived `2026-08-19-gate-settings-page-feature-flag` change.

`OverlayFeature.HideUserSettings` and `OverlayFeature.HideKeyboardShortcuts` still suppress the
corresponding rows inside the tab, and `OverlayFeature.HideUserMenu` still hides the menu carrying
the Settings entry — those are unrelated to the removed flag.

**Docs**

`docs/architecture.md` lists the `pages/` route folders and `apps/chat/src/context/` contexts; the
new `PreferencesTab` folder and the `DeploymentsContext` precedence change belong in the same
commit.

**Rollback**

Revert-safe and self-contained. Reverting restores the `UserMenu` submenus (the gating is additive,
not a deletion of the group builders) and leaves a stale `defaultAgent` localStorage entry that
nothing reads — harmless, and re-adopted if the change is re-landed. No data migration either way.
