## Why

StatGPT embeds the chat through the overlay with sign-in as its only account action (Issue #9519). In the expanded sidebar and the mobile drawer the user menu's `Profile` trigger already shows the avatar and display name, and opening it repeats the same avatar and name as the dropdown's first row. In a small menu the duplicate is noise. The existing `hide-user-menu` key is not a fix: it removes the whole menu, and this deployment must keep Log out.

## What Changes

- New overlay UI feature key `hide-user-menu-identity` (`OverlayFeature.HideUserMenuIdentity`). When on, the user menu's dropdown omits its identity row (avatar initials and display name). Settings, Log out and any preference submenus stay. It applies to the desktop sidebar and the mobile drawer, which share one `UserMenu` in `SidebarNavigation`.
- `UserMenu` in `@epam/ai-dial-navigation-panel` gains an optional `isIdentityHidden?: boolean` prop (default `false`, so existing hosts are unchanged). The lib decides nothing about overlay features. `SidebarNavigation` reads the flag and passes the boolean.
- When the identity row is hidden and no preference group renders, the dropdown also drops its leading divider. Otherwise the menu would open on a divider. The divider stays whenever something sits above it.
- The key is added to `KNOWN_UI_FEATURES` in `apps/chat-api` so `ENABLED_UI_FEATURES` accepts it. It is a modifier key and is not in `DEFAULT_ENABLED_UI_FEATURES`.
- Docs: the `chat-overlay-migration-guide.md` key list and sidebar paragraph, the `UserMenu` section of `libs/navigation-panel/README.md`, and the layout-key list in `docs/architecture.md`.

Non-goals:
- Hiding the name in the trigger itself. The trigger is the menu's only visible label and its accessible name (WCAG 2.5.3), so it stays.
- Changing `NavigationSheet`'s profile page. `apps/chat` does not mount it, and a library host composing it controls its own content.
- Any authorization meaning. This flag only changes presentation.

Alternatives considered: reusing `hide-user-menu` (rejected: it removes Log out, which the customer needs) and hiding the row automatically whenever the `Profile` trigger shows the name (rejected: it would change every deployment without opt-in, and the collapsed `Compact` trigger shows no name). An opt-in key matches how every other `hide-*` key works.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `ui-feature-toggles`: new requirement for `hide-user-menu-identity`. It drops the dropdown's identity row on both surfaces and leaves the rest of the menu alone.
- `user-menu`: the menu-item order and identity-header requirements become conditional on `isIdentityHidden`, and the leading divider is dropped when nothing precedes it.
- `chat-overlay-protocol`: the `OverlayFeature` enum grows from 55 to 56 members. The user-settings group gains `hide-user-menu-identity`.

## Impact

- `libs/chat-overlay/src/protocol/overlay-protocol.ts`: new enum member next to `HideUserMenu` (`overlay-protocol.ts:162`), plus its protocol test count (`tests/overlay-protocol.spec.ts:168`).
- `apps/chat-api/src/app-config/known-ui-features.constants.ts`: allowlist entry, plus its test count (`tests/known-ui-features.constants.spec.ts:16`).
- `libs/navigation-panel`: `UserMenuProps` (`src/models/user-menu-props.ts`) and the item assembly in `UserMenu.tsx:86-103`, plus `UserMenu.spec.tsx`. **Shared lib touched.** The change is a host-supplied boolean prop, so overlay and feature-flag knowledge stays in `apps/chat`. That follows the existing `isTooltipHidden` pattern on the same component.
- `apps/chat/src/components/Navigation/SidebarNavigation.tsx`: reads the flag next to `isUserMenuHidden` (`SidebarNavigation.tsx:83`) and passes it to `UserMenu` (`:179`). Test in `tests/SidebarNavigation.spec.tsx` follows the `hide-user-menu` case at `:483`.
- i18n: no new user-visible strings.
- Backward compatibility: additive and non-breaking. The prop defaults to `false` and the key defaults to off. To roll back, revert the commit. A deployment that set the key would see the identity row again, because unknown keys are dropped by the allowlist.

Acceptance criteria:
- With `hide-user-menu-identity` enabled, opening the user menu in the desktop sidebar or the mobile drawer shows no avatar-and-name row, and the first item is a preference group or Settings/Log out with no divider above it.
- With the key off, the menu is unchanged: identity, divider, Settings, Log out.
- `hide-user-menu` still removes the whole menu regardless of this key.
- `npm run validate:docs` and `npm run validate:specs` pass.
