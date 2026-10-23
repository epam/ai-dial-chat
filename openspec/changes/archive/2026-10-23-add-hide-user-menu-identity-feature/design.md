## Context

`UserMenu` (`libs/navigation-panel/src/components/UserMenu/UserMenu.tsx`) always puts an `identity` plain-text row (avatar initials and display name) first in its dropdown, then the preference groups, a divider, Settings and Log out. `SidebarNavigation` renders it with the `Profile` trigger, which shows the avatar and name, in the expanded desktop sidebar and in the mobile drawer. It uses the `Compact` (avatar-only) trigger in the collapsed desktop sidebar. The duplicate name the issue reports appears with the `Profile` trigger.

Overlay UI features flow through `UiFeaturesContext`, and components read them with `useUiFeature(OverlayFeature.X)`. Each key exists in two mirrored lists: the `OverlayFeature` enum in `libs/chat-overlay` and `KNOWN_UI_FEATURES` in `apps/chat-api`. The most recent example is `hide-usage-page` (commit `a07d511fb`), and this change follows the same touch-point set.

The change crosses three projects (overlay protocol, chat-api allowlist, navigation-panel lib) and the app.

## Goals / Non-Goals

**Goals:**
- One opt-in key that removes the identity row from the user menu on both surfaces, keeping Log out.
- Keep `UserMenu` host-agnostic, with no knowledge of overlay features.
- Avoid a dropdown that opens on a divider.

**Non-Goals:**
- Changing the trigger, `NavigationSheet`'s profile page, or `hide-user-menu`'s behavior.
- New strings, styling tokens or `dial-*` classes.

## Decisions

1. **Lib API is a boolean prop, `isIdentityHidden?: boolean`.** This matches the existing `isTooltipHidden` prop on the same component (an `is*Hidden` boolean set by the host), so the lib stays isolated: the app maps `OverlayFeature.HideUserMenuIdentity` to the prop in `SidebarNavigation`. Alternatives: a `showIdentity` prop defaulting to `true` (rejected: a `true` default reads worse next to `isTooltipHidden`, and `false`-by-default booleans are this lib's convention), or an `items` filter callback (rejected: it generalizes beyond the need and exposes item keys as API).

2. **The divider renders only when something precedes it.** Today the divider always follows the identity row, so it is never first. Once the identity can be hidden, a host with no groups would get a menu that opens on a divider. The rule "render `divider-1` only when the identity row or at least one group is present" keeps today's output byte-identical when the prop is off.

3. **The key hides the whole row, not only the name.** The row is avatar initials plus name. A lone initials badge at the top of the menu would repeat the trigger's avatar for no benefit. The issue's wording ("hide user's name which appears at the top of the menu") describes that row.

4. **Applied regardless of trigger variant.** The flag is applied the same way to the `Profile` and `Compact` triggers. Hiding it only when the trigger shows the name would make the menu content depend on the sidebar's collapsed state, which an operator cannot predict from the key's name. In the collapsed state the user's identity is still reachable through the trigger's email tooltip and accessible name.

5. **Key name `hide-user-menu-identity`.** It sits next to `hide-user-menu` in the user-settings group and names what is removed (the identity row) using the term the `user-menu` spec already uses. The issue's informal "user's name" is covered in the docs wording.

## Risks / Trade-offs

- [In the collapsed desktop sidebar, the trigger shows only the avatar. With the key on, the menu shows no name either.] → This is an opt-in key aimed at overlays. The email tooltip and accessible name still identify the user. The migration-guide entry calls this out.
- [Adding an enum member changes the mirrored counts (55 → 56) in two tests and two spec texts.] → Both lists and their tests are updated in the same slice. The `chat-overlay-protocol` delta spec carries the new count.
- [Touching a published lib.] → Additive optional prop, default off, and no change to manifests, so no install-matrix regeneration. The README's `UserMenu` section documents the prop. Per project convention the lib version is not bumped.

## Migration Plan

Additive. Deployments opt in with `ENABLED_UI_FEATURES` or overlay `enabledFeatures`. To roll back, revert the change. A deployment that still sends the key gets it dropped as unknown and sees the identity row again.

## Open Questions

None blocking. If the customer also wants the trigger's name gone, that would be a separate key, because it changes the trigger's accessible-name contract.
