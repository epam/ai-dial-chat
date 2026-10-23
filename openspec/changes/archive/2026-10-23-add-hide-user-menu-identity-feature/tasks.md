Slicing strategy: contract-first in a small form. Slice 1 makes the key an accepted value on both sides of the mirrored contract. Slice 2 adds the lib prop. Slice 3 wires the flag to the prop in the app, which delivers the feature end to end. Slice 4 is docs and specs. No endpoint, i18n key or RTL-sensitive layout is added: the change removes one existing row.

## 1. Feature key contract

- [x] 1.1 Add `HideUserMenuIdentity = 'hide-user-menu-identity'` to `OverlayFeature` in `libs/chat-overlay/src/protocol/overlay-protocol.ts`, directly after `HideUserMenu`, with a one-line JSDoc ("Hides the identity row — avatar and name — at the top of the user menu's dropdown; Settings and Log out stay."). In `libs/chat-overlay/src/protocol/tests/overlay-protocol.spec.ts`, change the member count from 55 to 56 and assert `'hide-user-menu-identity'` is present.
- [x] 1.2 Add `'hide-user-menu-identity'` after `'hide-user-menu'` in `KNOWN_UI_FEATURES` (`apps/chat-api/src/app-config/known-ui-features.constants.ts`). In `apps/chat-api/src/app-config/tests/known-ui-features.constants.spec.ts`, change the count from 55 to 56. Do not add the key to `DEFAULT_ENABLED_UI_FEATURES`.

Verification:
- `npm run test:file -- libs/chat-overlay/src/protocol/tests/overlay-protocol.spec.ts`
- `npm run test:file -- apps/chat-api/src/app-config/tests/known-ui-features.constants.spec.ts`

## 2. UserMenu `isIdentityHidden` prop (libs/navigation-panel)

- [x] 2.1 Add `isIdentityHidden?: boolean` to `UserMenuProps` in `libs/navigation-panel/src/models/user-menu-props.ts`, next to `isTooltipHidden`, with JSDoc ("Omits the identity row — avatar initials and display name — from the top of the dropdown. Defaults to `false`.").
- [x] 2.2 In `libs/navigation-panel/src/components/UserMenu/UserMenu.tsx`, destructure `isIdentityHidden = false`. Build the `identity` item only when it is `false`. Emit `divider-1` only when the identity item or at least one group item is present. Add `isIdentityHidden` to the `items` `useMemo` deps. When the prop is off, the item list must stay exactly as it is today.
- [x] 2.3 Extend `libs/navigation-panel/src/components/UserMenu/tests/UserMenu.spec.tsx` with behaviour tests that open the dropdown and query by role and text:
  - with `isIdentityHidden`, the display name does not appear in the menu but the trigger still has its accessible name;
  - with `isIdentityHidden` and no groups, there is no `separator` and Settings/Log out are present;
  - with `isIdentityHidden` and a non-empty group, the separator stays after the group;
  - without the prop, the identity row and divider render as before.
- [x] 2.4 Architecture guard: confirm the lib change imports nothing from `@epam/ai-dial-chat-overlay`, `apps/*`, contexts, or feature-flag code. The flag reaches the lib only as the boolean prop.

Verification:
- `npm run test:file -- libs/navigation-panel/src/components/UserMenu/tests/UserMenu.spec.tsx`
- `npm run test:file -- libs/navigation-panel/src/components/UserMenu/tests/UserMenuProfile.spec.tsx`

## 3. App wiring (apps/chat)

- [x] 3.1 In `apps/chat/src/components/Navigation/SidebarNavigation.tsx`, read `const isUserMenuIdentityHidden = useUiFeature(OverlayFeature.HideUserMenuIdentity);` next to `isUserMenuHidden`, and pass `isIdentityHidden={isUserMenuIdentityHidden}` to `UserMenu`. That single render covers the desktop column and the mobile drawer.
- [x] 3.2 In `apps/chat/src/components/Navigation/tests/SidebarNavigation.spec.tsx`, add a test next to `renders no user menu when hide-user-menu is on`. With `hide-user-menu-identity` on, open the user menu and assert that the user's display name is absent from the menu while Log out is present. Add a mobile-viewport variant if the existing suite already toggles `useIsMobile`. Check that the existing `feature !== OverlayFeature.HideUserMenu &&` mock filters still leave the new key off by default.

Verification:
- `npm run test:file -- apps/chat/src/components/Navigation/tests/SidebarNavigation.spec.tsx`
- `npm run verify:changed` (end of slices 1–3)

## 4. Docs and specs

- [x] 4.1 `docs/chat-overlay-migration-guide.md`:
  - add `hide-user-menu-identity` after `hide-user-menu` in the key list;
  - in the sidebar paragraph, add a sentence: it removes the avatar-and-name row at the top of the user menu (desktop and drawer) while keeping Settings and Log out, `hide-user-menu` overrides it, and in the collapsed sidebar the user is then identified only by the avatar and its email tooltip.
- [x] 4.2 `libs/navigation-panel/README.md` `UserMenu` section: document `isIdentityHidden`, including the divider rule. Make sure any code fence that passes it matches the real prop name and type.
- [x] 4.3 `docs/architecture.md`: add `hide-user-menu-identity` to the layout-key list beside `hide-user-menu`.
- [x] 4.4 Run `npm run validate:docs` and `npm run validate:specs`, and fix any failures.

Verification:
- `npm run validate:docs`
- `npm run validate:specs`

## 5. Close

- [ ] 5.1 Run `npm run verify:full` once.
