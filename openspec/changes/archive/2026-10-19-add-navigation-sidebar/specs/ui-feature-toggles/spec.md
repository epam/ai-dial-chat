## REMOVED Requirements

### Requirement: hide-navigation-menu removes the hamburger and the sheet it opens

**Reason**: The mobile hamburger and `NavigationSheet` are replaced by the sidebar drawer and its header toggle.

**Migration**: Replaced by "hide-navigation-menu removes the navigation part of the mobile drawer".

### Requirement: hide-keyboard-shortcuts removes the entry on both profile surfaces

**Reason**: The mobile profile sheet is replaced by the drawer's user menu.

**Migration**: Replaced by "hide-keyboard-shortcuts removes the entry wherever it is offered".

### Requirement: The Settings page is reachable on both layouts and hide-settings-page removes it

**Reason**: Settings opens as a dialog from the sidebar's user menu, and Usage is its own page.

**Migration**: Replaced by "The Settings dialog is reachable from the user menu and hide-settings-page removes it".

## MODIFIED Requirements

### Requirement: A key that gates a route hides both the entry point and the route

A feature key whose owning surface is a whole route SHALL gate the navigation entry and the route element together, so that a direct URL cannot reach a section whose entry point is hidden. `file-manager` SHALL gate the File Manager navigation entry (the sidebar's item list, in the desktop column and the mobile drawer, fed by `SidebarNavigation` through `useNavigationItems`, which wraps the shared `useVisibleNavItems` hook) and the `ROUTES.FileManager` route element, which SHALL redirect to `ROUTES.Root` with `replace` when the key is disabled.

Route gating SHALL NOT be treated as an authorization boundary: the backend SHALL continue to enforce access to the underlying data and operations regardless of which keys are enabled.

**Accessibility:** A hidden navigation entry is not rendered at all, so it leaves neither an accessibility-tree node nor a tab stop.

**i18n impact:** None — the entry's existing translated label is shown or omitted; no new strings.

#### Scenario: file-manager hides the navigation entry on both layouts

- **WHEN** `isEnabled('file-manager')` is `false`
- **THEN** neither the desktop sidebar nor the mobile drawer renders a File Manager entry, and every other navigation entry is unaffected

#### Scenario: A direct /files URL does not bypass the hidden entry

- **WHEN** `isEnabled('file-manager')` is `false` and the user navigates directly to `/files`
- **THEN** the app redirects to `/` with `replace`, and `DialFileManagerPage` is never mounted

#### Scenario: file-manager is independent of the in-chat attachment flow

- **WHEN** `isEnabled('file-manager')` is `false` and `isEnabled('input-files')` is `true`
- **THEN** the conversation input still renders the attach-file button and can open the file-manager modal — only the standalone `/files` section is gone

## ADDED Requirements

### Requirement: hide-navigation-menu removes the navigation part of the mobile drawer

`isEnabled('hide-navigation-menu')` SHALL remove the navigation part of the mobile sidebar drawer: `SidebarNavigation` SHALL render the drawer with no navigation items, no user menu and no Usage link, and `Header` SHALL render the sidebar toggle only while the conversation list stays reachable through it, that is while `isEnabled('conversations-section')` and `isEnabled('conversations-panel-toggle')` are both `true`. The drawer then carries the conversation block alone, as the earlier conversation drawer did. Everything else is omitted rather than hidden, so no focusable row of the removed part stays in the tab order.

The key SHALL NOT affect the desktop sidebar or its user menu. `hide-user-menu` governs the user menu on both surfaces: it removes the menu from the desktop sidebar and from the mobile drawer, where the earlier mobile sheet ignored it. It exists for embeds whose host portal already handles sign-in and sign-out, making the user menu's log-out row dead weight.

**RTL impact:** None — the removed controls are omitted, not repositioned.

**Accessibility:** The omitted items and toggle leave neither an accessibility-tree node nor a tab stop.

**i18n impact:** None — existing translated labels are omitted along with their controls.

#### Scenario: The toggle stays while the chats are reachable

- **WHEN** `isEnabled('hide-navigation-menu')` is `true`, the conversations section is on and its panel toggle is on
- **THEN** the header renders the sidebar toggle, and the drawer it opens holds the conversation block with no items, user menu or Usage link

#### Scenario: The toggle is gone when nothing is reachable

- **WHEN** `isEnabled('hide-navigation-menu')` is `true` and the conversations section or its panel toggle is off
- **THEN** the header renders no sidebar toggle

#### Scenario: The desktop sidebar is untouched

- **WHEN** `isEnabled('hide-navigation-menu')` is `true` and `isEnabled('hide-user-menu')` is `false`
- **THEN** the desktop sidebar still renders its items and user menu

#### Scenario: The drawer renders by default

- **WHEN** no `enabledUiFeatures` and no overlay override are present
- **THEN** the key is default-off, so the header toggle renders and opens the full drawer

### Requirement: hide-keyboard-shortcuts removes the entry wherever it is offered

`isEnabled('hide-keyboard-shortcuts')` SHALL remove the Keyboard shortcuts entry from every surface that offers it: the Preferences fields shared by the Settings dialog and the Settings page's Preferences tab (`PreferencesFields`), and the keyboard group of the mobile drawer's user menu, which `useNavigationMenuGroups` omits. `isEnabled('hide-user-settings')` SHALL also remove it everywhere, so the surfaces agree; `hide-keyboard-shortcuts` SHALL NOT affect the other settings entries `hide-user-settings` governs — with only `hide-keyboard-shortcuts` enabled the language entry SHALL still render wherever it is offered (it is offered only when `SUPPORTED_LANGUAGES` holds more than one locale, which no shipping build does today).

Hiding the entry SHALL NOT change send behavior: the `SendOnEnter` preference is read from storage by `ConversationView` and `NewConversationComposer` independently of this key, and continues to resolve to its stored value, defaulting to `SendOnEnter.Enter`.

**Accessibility:** The entry is not rendered, so it leaves neither an accessibility-tree node nor a tab stop.

**i18n impact:** None — the existing translated label is shown or omitted; no new strings.

#### Scenario: The entry disappears everywhere

- **WHEN** `isEnabled('hide-keyboard-shortcuts')` is `true` and the user opens the Settings dialog or the mobile drawer's user menu
- **THEN** no Keyboard shortcuts entry is rendered, and the other Preferences rows (theme, language, default agent) keep their own visibility rules

#### Scenario: hide-user-settings hides it too

- **WHEN** `isEnabled('hide-user-settings')` is `true`
- **THEN** the Keyboard shortcuts entry is absent from the Settings dialog, the Preferences tab and the drawer's user menu

#### Scenario: Send-on-Enter keeps working while the entry is hidden

- **WHEN** `isEnabled('hide-keyboard-shortcuts')` is `true` and the stored preference is `SendOnEnter.MetaEnter`
- **THEN** the conversation input still sends on `⌘`/`Ctrl`+Enter

### Requirement: The Settings dialog is reachable from the user menu and hide-settings-page removes it

`SidebarNavigation` SHALL offer Settings through the sidebar user menu's Settings entry, in the desktop column and in the mobile drawer, which opens the Settings dialog. The `/settings` page remains routable. When `isEnabled('hide-settings-page')` is `true`, the Settings entry and the Usage link SHALL be omitted, and the `/settings` and `/usage` routes SHALL redirect to `/` with `replace`. `SettingsPage` SHALL stack its section list above the active tab at full width on the mobile breakpoint and keep the 240px side column on desktop.

**Accessibility:** The Settings entry is a labeled menu item; its icon is `aria-hidden`.

**i18n impact:** None — the entry reuses the existing `BasicI18nKeys.Settings` string.

#### Scenario: Users reach Settings from the user menu

- **WHEN** the user opens the sidebar's user menu, at any width, and chooses Settings
- **THEN** the Settings dialog opens and the route does not change

#### Scenario: hide-settings-page removes every entry point

- **WHEN** `isEnabled('hide-settings-page')` is `true`
- **THEN** the user menu renders no Settings entry, the footer renders no Usage link, and a direct `/settings` or `/usage` URL redirects to `/`
