## Slicing strategy

Risk-first, then vertical. Slice 1 proves the only change that can break library hosts (the `ConversationPanel` extraction) before anything is built on it. Later slices each leave the app working.

Every task that touches `libs/*` carries this architecture guard: verify the lib contains no feature-key (or any app feature flag), router, i18n, app-context, theme, session, `/api` path, `server-api` or generated-client import (AGENTS.md "Library isolation"; `.claude/rules/libs.md`).

Verification commands use `npm run test:file -- <path>`. Run `npm run verify:changed` once after each completed slice. Run `npm run verify:full` exactly once, in group 12.

## 1. Extract `ConversationList` (no visible change)

- [x] 1.1 In `libs/conversation-panel`, add `ConversationList` (`src/components/ConversationList/ConversationList.tsx`) holding the list body now inside `ConversationPanel`: expanded-groups state, scroll-to-active, drag-and-drop state, skeleton/empty/no-results states and the live region. Take `searchQuery` and `activeFilter` as controlled props; add `ConversationListProps`, `ConversationListLabels`, `ConversationListStyles`, `ConversationListColors`. Verify `npm run test:file -- libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx` still passes with no edits to that file.
- [x] 1.2 Recompose `ConversationPanel` through `ConversationList`, keeping its props, output and `dial-cp-*` classes. Verify these pass unmodified: `ConversationPanel.spec.tsx`, `ConversationRow.spec.tsx`, `FilterTabs.spec.tsx`, `NewChatButton.spec.tsx`, `RenameConversationPopup.spec.tsx`, and `libs/sidebar/src/components/SidebarPanel/tests/SidebarPanel.classes.spec.tsx`.
- [x] 1.3 Add `libs/conversation-panel/src/components/ConversationList/tests/ConversationList.spec.tsx` covering controlled filter and search with highlighting, grouping, `hiddenSources`, loading/empty/no-results states, active-row `aria-current` and scroll, drag-and-drop move callback, and that the row-render count on active change stays limited to the two affected rows. Verify the file passes.
- [x] 1.4 Export `ConversationList` and its types from `libs/conversation-panel/src/index.ts`; add `CONVERSATION_PANEL_CLASS.list` (`dial-cp-list`) to `src/constants/public-class-names.ts`. Run the architecture guard. Verify `npm exec nx build @epam/ai-dial-conversation-panel` succeeds and a test asserts the root carries `dial-cp-list`.
- [x] 1.5 Run `npm run verify:changed` and confirm slice 1 is green. (Typecheck, lint and tests of every project this slice touches pass. The aggregate command still fails on `@epam/ai-dial-skill-editor:typecheck` — `renderItemActions` missing from the installed ui-kit's `DialFoldersTreeProps` — which fails identically without this change's edits.)

## 2. Indicator rows and the list header (conversation-panel)

- [x] 2.1 Add the string enum `ConversationRowVariant` (`Avatar`, `Indicator`) under `libs/conversation-panel/src/types/`, a `rowVariant` prop on `ConversationList`, and the `Indicator` rendering in `ConversationRow` (hollow or filled dot, semi-bold unread title, no avatar, no `leadingIcon`, no trailing dot, hidden unread label kept). Make `getRowHeight` in `src/utils/conversation-row.ts` variant-aware, reading exact metrics from the Figma `.navigation-chat` and `.navigation-section` frames via `get_design_context`. Verify `ConversationRow.spec.tsx` passes with no edits, plus new `Indicator` cases in a new spec, and `src/utils/tests/conversation-row.spec.ts` covers both variants.
- [x] 2.2 Add `ConversationListHeader` (`src/components/ConversationListHeader/`): title button with `aria-expanded`, search toggle swapping to kit `Search` plus a Close search button and Escape handling with focus return, filter `Dropdown` with `MenuItemMark.Check` excluding `hiddenSources`, and an `actions` slot. All labels as props; typography as `*ClassName` props defaulting to verified `dial-*-text` classes (`getEntityDetails("typography")`). Add `dial-cp-list-header` and `ConversationListHeaderProps`/`ConversationListHeaderLabels`. Verify a new `ConversationListHeader.spec.tsx` covers open/close/Escape/focus return, filter selection, omitted controls and the `actions` slot.
- [x] 2.3 Keep the list's color overrides mapped one-to-one onto the existing `--cp-*` variables (`ConversationListColors`), with no unused variable and logical properties only. Run the architecture guard. Verify `npm exec nx lint @epam/ai-dial-conversation-panel` and the lib tests pass.
- [x] 2.4 Update `libs/conversation-panel/README.md` (new exports, the variant enum, `dial-cp-list` / `dial-cp-list-header` in the class table, a `ConversationList` example that compiles against the current props). Verify `npm run validate:docs`.
- [x] 2.5 Run `npm run verify:changed` and confirm slice 2 is green.

## 3. Layout hook

- [x] 3.1 (Dropped: no `navigation-sidebar` key, enum member, default or known-feature entry is added. The sidebar is the desktop layout of the app; see proposal option C and design D1.)
- [x] 3.2 (Dropped with 3.1: `apps/chat-api` and `libs/chat-overlay` are untouched.)
- [x] 3.3 Add `apps/chat/src/hooks/navigation/useIsNavigationSidebarLayout.ts` (JSDoc stating why it is the single switch point) returning `!useIsMobile()`. Verify a new `tests/useIsNavigationSidebarLayout.spec.tsx` covers desktop, mobile and a resize crossing 1280px.
- [x] 3.4 Run `npm run verify:changed` and confirm slice 3 is green.

## 4. `NavigationSidebar` (navigation-panel)

- [x] 4.1 Add `libs/navigation-panel/src/components/NavigationSidebar/NavigationSidebar.tsx` with its models (`NavigationSidebarProps`, `NavigationSidebarLabels`, `NavigationSidebarLogo`, `NavigationSidebarColors`, `NavigationSidebarStyles`) per design D5: expanded and collapsed header, item rows and icon buttons with tooltips, `children` slot kept mounted but `inert` when collapsed, footer slots in per-state DOM order, `aria-expanded` and `aria-controls` toggle, reduced-motion handling. Reuse the existing `NavigationPanelItem` and `NavigationLinkRenderer`. Verify a new `NavigationSidebar.spec.tsx` covers both states, toggle semantics, `aria-current`, `inert` on children, footer order per state, absent toggle without `onToggleCollapse`, and `renderLink`.
- [x] 4.2 Add the stylesheet with logical properties and `--np-sidebar-*` variables mapped one-to-one in both directions, and add `NAVIGATION_PANEL_CLASS.sidebar`, `.sidebarItem` and `.sidebarFooter` without touching `rail` or `item`. Verify the existing `NavigationPanel.spec.tsx` passes unmodified and a test asserts the new classes and the absence of `dial-navigation-panel-rail` on the sidebar.
- [x] 4.3 Export `NavigationSidebar` and its types from `libs/navigation-panel/src/index.ts`. Run the architecture guard. Verify `npm exec nx build @epam/ai-dial-navigation-panel` and `npm exec nx lint @epam/ai-dial-navigation-panel` succeed.
- [x] 4.4 Add the string enum `UserMenuTriggerVariant` (`Avatar`, `Profile`) and a `triggerVariant` prop to `UserMenu` per design D6: `Profile` shows avatar, truncated name and a chevron flipping on open, with `top-start` placement. Default stays byte-identical. Verify `UserMenu.spec.tsx` passes with no edits and new cases cover the `Profile` trigger's accessible name, tooltip and placement.
- [x] 4.5 Update `libs/navigation-panel/README.md` (new component, props, the variant enum, public classes, theming variables, compile-checked examples). Verify `npm run validate:docs`.
- [x] 4.6 Run `npm run verify:changed` and confirm slice 4 is green.

## 5. State and items in the app

- [x] 5.1 Add an `isSidebarLayout` parameter to `apps/chat/src/hooks/conversation-panel/useConversationPanelRouteState.ts`: when true, skip the off-section force-close and re-apply the user's choice or `isOpenByDefault` on navigation, keeping the canvas effects. Verify the existing `tests/useConversationPanelRouteState.spec.tsx` cases pass unmodified and new cases cover navigation to `/catalog` and back, user collapse surviving navigation, the default start state, and canvas open collapsing.
- [x] 5.2 Add the optional `sidebar` override (icon, active icon, label key, exact match) to `NavigationItem` in `apps/chat/src/constants/navigation.ts` and widen `labelKey` to accept `ButtonsI18nKeys`. Add the filled and outline circle-plus icons following `constants/icons/filled-icons`. Verify `npm run test:file -- apps/chat/src/constants/tests` (or the nearest existing spec) and typecheck pass.
- [x] 5.3 Make `useNavigationItems` apply the override in the sidebar layout (label "New chat", exact `/` matching, omitted under `hide-new-conversation`) and leave the legacy path untouched. Verify a new `hooks/navigation/tests/useNavigationItems.spec.tsx` covers legacy active inside a conversation, sidebar not active inside a conversation, the label in each layout, and the `hide-new-conversation` and `file-manager` gates.
- [x] 5.4 Run `npm run verify:changed` and confirm slice 5 is green.

## 6. Compose the layout in the app

- [x] 6.1 Add the app enum `ConversationPanelLayout` (`Panel`, `Sidebar`) under `apps/chat/src/types/` and a `layout` prop to `ConversationPanelView`. In `Sidebar`, render `ConversationListHeader` and `ConversationList` (indicator rows, hidden-source and filter wiring, `conversations-section` and `hide-conversations-filter` respected) with local search, filter and expanded state, and pass `ConversationPanelMenu` as `actions`. Keep `getActions`, the dialogs, transfer queues and the import input shared. Verify `ConversationPanelView.spec.tsx` passes unmodified and new `Sidebar` cases cover rendering, search, filter, row actions, the overflow menu and `hide-conversation-export`.
- [x] 6.2 Add `SidebarNavigation.tsx`, mounted by `app.tsx` in place of `Navigation` when `useIsNavigationSidebarLayout` is true, rendering `NavigationSidebar`: logo and favicon resolved with the celebration icon, `isCollapsed` from `!isPanelOpen`, toggle gated by `conversations-panel-toggle`, `UserMenu` with `triggerVariant` per state under the existing auth and `hide-user-menu` conditions, the Usage link to `getSettingsTabRoute(SettingsTabs.Usage)` omitted under `hide-settings-page`, and the `chats` slot. Verify `SidebarNavigation.spec.tsx` covers each of those and `Navigation.spec.tsx` is unchanged apart from the default posture excluding the new key.
- [x] 6.3 In `app.tsx`, build the `ConversationPanelView` element once and pass it to `SidebarNavigation` as `chats` in the sidebar layout, otherwise (a mobile viewport) render it as the existing sibling next to `Navigation`; pass `isSidebarLayout` to the route-state hook. Verify `app/tests/appSidebarLayout.spec.tsx` covers desktop, a mobile width, the route-state argument, the collapsed state and the isolated view.
- [x] 6.4 In `ChatLayout.tsx`, drop the panel toggle and the "+" button from the desktop top bar in the sidebar layout, keeping the logo and sources toggle. Verify `ChatLayout.spec.tsx` keeps its legacy cases and adds sidebar-layout cases.
- [x] 6.5 Move `CELEBRATION_HISTORY_CLASS` onto the `ConversationList` root in the sidebar layout. Verify a test asserts the anchor class is present in both layouts.
- [x] 6.6 Run `npm run verify:changed` and confirm slice 6 is green.

## 7. i18n

- [x] 7.1 Add `conversationPanel.chatsAndTasks`, `conversationPanel.search.open`, `conversationPanel.search.close`, `navigation.collapseSidebar` and `navigation.expandSidebar` to `apps/chat/src/i18n/locales/en.json` and the matching enum members to `apps/chat/src/constants/translation-keys.ts`, reusing `ButtonsI18nKeys.NewChat`, `BasicI18nKeys.Usage`, `BasicI18nKeys.SearchPlaceholder`, `BasicI18nKeys.ClearSearch` and the existing filter keys. Verify no raw string key reaches `t()` and the existing locale-key test passes.

## 8. RTL and accessibility

- [x] 8.1 Audit the new lib and app styles for physical-direction classes and properties, mirror only the sidebar-toggle glyph with `rtl:scale-x-[-1]`, and add RTL tests (`dir="rtl"`) for placement and the toggle glyph. Verify the RTL cases pass and `npm exec nx run-many -t lint -p @epam/ai-dial-navigation-panel @epam/ai-dial-conversation-panel @epam/chat` is clean.
- [x] 8.2 Add accessibility tests for toggle `aria-expanded` and name swap, `inert` on the collapsed chats, the live region announcing loading/empty/no-results, icon-only item names and tooltips, and collapsed-footer focus order. Verify the cases pass.

## 9. Responsive and layout check

- [x] 9.1 Review Catalog, File manager, Settings and Scheduled Tasks at 1280x800 with the sidebar expanded and collapsed, following the `responsive-design` skill. Record any overflow as an explicit follow-up task, not an inline fix. Verify the review notes are added to this file under "Follow-ups".

## 10. Documentation and specs

- [x] 10.1 Update `docs/architecture.md` (the navigation and panel description, the `ConversationPanelContext` meaning, the new `NavigationSidebar` and `ConversationList` entries and the public-class list) and `docs/chat-overlay-migration-guide.md` (the `navigation-sidebar` key, its interaction with each layout key, the host-CSS review note and a `ENABLED_UI_FEATURES` example). Verify `npm run validate:docs`.
- [x] 10.2 (Not applicable: the sandbox's enabled-features case lists a sample subset, not the layout keys.) Add `navigation-sidebar` to the overlay sandbox's enabled-features case if a case lists the layout keys. Verify `apps/chat-overlay-sandbox/src/cases/EnabledFeaturesCase/tests/EnabledFeaturesCase.spec.tsx` passes.
- [x] 10.3 Verify `npm run validate:specs` and `openspec validate add-navigation-sidebar --strict` both pass.

## 11. Follow-ups (record only, do not implement here)

- [ ] 11.1 Create tracked follow-ups for: Date & time and Extensions in the Settings dialog; a close-on-empty option for the kit `Search`; extracting `useConversationPanelController` out of `ConversationPanelView`; a deprecation note for `NavigationPanel` once no host needs it. Verify each is listed in the PR description.

## 12. Final verification

- [x] 12.1 Run the verification of the touched projects (tests, lint, `tsc`, docs and spec validation) and confirm it passes. The only remaining failure is the baseline `@epam/ai-dial-skill-editor` typecheck, which this change does not touch. Edits to existing test files follow the removal of `Navigation`, the layout hook and the feature key.
- [x] 12.2 Run `npm run build:quiet` because bundling is affected (new exports in three libs), and confirm it succeeds.

## 13. Added during implementation

- [x] 13.1 Standalone Usage page at `ROUTES.Usage` (`/usage`) in the sidebar layout; Usage removed from the Settings tab list there and `/settings/usage` redirects to it. Verified by the `useSettingsTabConfig`, `SettingsPage`, `UsageTab` and `app` specs.
- [x] 13.2 Settings as a dialog (`SettingsModal`) with draft state applied on Save, opened from the user menu in the sidebar layout, built on the shared `PreferencesFields`. Verified by `SettingsModal.spec.tsx` and the Navigation sidebar-layout spec.
- [x] 13.3 File manager page frame (title, 32px margins, card with 20px padding) from the `desktop` band in both layouts, a phone keeping the full-bleed manager, with an optional `surfaceClassName` on `DialFileManagerShell`. Verified by `DialFileManagerPage.spec.tsx`.
- [x] 13.4 `UserMenuTriggerVariant.Compact` for the collapsed sidebar footer. Verified by `UserMenuProfile.spec.tsx`.
- [x] 13.5 (Superseded: the key was removed, see 15.)
- [x] 13.6 One layout branch per shell: `app.tsx` mounts `SidebarNavigation` or the unchanged `Navigation`, and `ConversationPanelView` renders the lib `ConversationListSection` or `ConversationPanel`. Page headers carry no layout branch. Verified by `SidebarNavigation.spec.tsx`, `appNavigation.spec.tsx`, `ConversationPanelViewSidebar.spec.tsx`. Superseded by 16.4: there is one shell at every width.

## 14. Review fixes

- [x] 14.1 Leaving the sidebar layout re-applies the route rules, so the panel does not stay open on `/catalog`. Verified by `useConversationPanelRouteState.spec.tsx`; superseded by 16.4, where the route no longer drives the panel.
- [x] 14.2 Without `conversations-panel-toggle` the sidebar returns to its default when the canvas closes. Verified by the same spec.
- [x] 14.3 `tsc -p apps/chat/tsconfig.spec.json` clean (unused scaffold removed from the new specs).
- [x] 14.4 The `Profile` trigger is named by its visible display name (WCAG 2.5.3). Verified by `UserMenuProfile.spec.tsx`.
- [x] 14.5 `/usage` titles the page with an `h1`; the chats block is a named `section`. Verified by `UsageTab.spec.tsx` and `ConversationPanelViewSidebar.spec.tsx`.
- [x] 14.6 Lib styling: the sidebar footer follows `colors.background`, keyboard focus gets the hover background, and `ConversationListHeader` drops the redundant `uppercase` and takes `searchTextClassName`.
- [x] 14.7 Isolated view test in `appNavigation.spec.tsx`; docs and spec deltas brought in line with the code (`docs/architecture.md`, migration guide counts, `file-manager-standalone-page` and `file-manager-attach-modal-polish` deltas).

## 15. Remove the feature key

- [x] 15.1 Drop `OverlayFeature.NavigationSidebar`, its `KNOWN_UI_FEATURES` entry and its `DEFAULT_ENABLED_UI_FEATURES` entry; counts return to 51 and 26. `useIsNavigationSidebarLayout` becomes `!useIsMobile()`.
- [x] 15.2 `app.tsx` mounts `SidebarNavigation` at every width and `Navigation` is removed (16.4); its item and user-menu cases live in `SidebarNavigation.spec.tsx`.
- [x] 15.3 `/usage` is registered through `renderUsageRoute`: it redirects to `/` when the settings page is hidden, and `/settings/usage` redirects to it. Verified by `settings-routes.spec.tsx` and `SettingsPage.spec.tsx`.
- [x] 15.4 Review fixes: the sidebar toggle keeps keyboard focus on collapse (`NavigationSidebar.spec.tsx`), the chats block is a named region, and `ConversationListHeader` takes `styles.colors` and `searchTextClassName`.
- [x] 15.5 Docs and specs describe the layout without a key: `docs/architecture.md`, `docs/chat-overlay-migration-guide.md` and the deltas of this change; the `ui-feature-toggles` and `chat-overlay-protocol` deltas are removed.

## 16. Mobile drawer and header

- [x] 16.1 `NavigationSidebar` gets `variant` (`Sidebar`, `Drawer`), `onClose` and `labels.close`; the drawer is 320px with a logo and close button in its header and ignores `isCollapsed`. `NavigationSidebarVariant` is exported and the README documents it. Verified by `NavigationSidebar.spec.tsx`.
- [x] 16.2 `SidebarNavigation` renders the drawer on mobile: a fixed, RTL-aware sliding panel with `id` `MOBILE_SIDEBAR_ID`, `inert` while closed, focus in and back out, and closing on Escape, a route change and a chosen chat. Under `hide-navigation-menu` it keeps the chats and drops the items, user menu and Usage link (`useMobileSidebarContent`). Its user menu carries the keyboard group. Verified by `SidebarNavigation.spec.tsx`.
- [x] 16.3 The mobile `Header` follows Figma: sidebar toggle with `aria-expanded` and `aria-controls`, a New chat button on every route, the logo, the sources toggle with the right-panel glyph, and a bottom divider. Verified by `Header.spec.tsx`.
- [x] 16.4 `app.tsx` mounts `SidebarNavigation` at every width; `Navigation.tsx`, the layout hook, `ConversationPanelLayout`, the legacy panel branch of `ConversationPanelView`, the hamburger and the panel toggle are removed; `useConversationPanelRouteState` drops the route-driven branch. `NAVIGATION_CONFIG` carries New chat directly. Verified by `appNavigation.spec.tsx`, `useConversationPanelRouteState.spec.tsx` and `useNavigationItems.spec.tsx`.
- [x] 16.5 The Usage tab is gone from Settings (Usage is the `/usage` page at every width), `/settings/usage` redirects there, and the Settings dialog fits a phone. Unused navigation translation keys are removed.
- [x] 16.6 Spec deltas for the sheet, the user menu, routing, isolated view, footer message, keyboard shortcut, auth and the feature toggles; the architecture doc and the migration guide describe the single sidebar.
- [x] 16.7 Review the drawer and the header in a browser at 360px, 768px and 1024px, in LTR and RTL, with the keyboard.

## 17. Library review fixes

- [x] 17.1 `NavigationSidebarTypography.fontClassName` replaces `itemClassName` and is applied to item labels only, not the `<nav>` root.
- [x] 17.2 Public classes are the last argument of `mergeClasses` in `ConversationList` and `ConversationListHeader`; guard tests cover `sidebarItem`, `sidebarFooter`, `listHeader` and `list`, each located by role or a labelled neighbour.
- [x] 17.3 `ConversationListHeader` takes its typography under `styles.typography` (`ConversationListHeaderTypography`), and its labels use `filterLabels: FilterLabels`, whose `groupAriaLabel` names the trigger.
- [x] 17.4 `ConversationPanelLabels` and `ConversationPanelTypography` extend the list's types; `UserMenuColors.triggerOpenBackground` (`--np-trigger-open-bg`), `ConversationListColors.indicatorDot` (`--cp-indicator-dot`) and `NavigationSidebarColors.focusOutline` (`--np-sidebar-focus-outline`) are added; the header variables become `--cp-list-header-title*`.
- [x] 17.5 Clean-ups: no `border-radius` in the sidebar stylesheet, one focus fallback, `NavigationSidebarLogo extends NavigationPanelLogo`, one-line JSDoc, `DIAL_ICON_SIZE.SM` for the group-header chevron, the filter helpers in `src/utils/conversation-filter.ts`, and one branch for the `Avatar` and `Compact` triggers. READMEs updated.

## 18. Move the new shell and section into the libs

Only what this change added moves; the mobile `Header`, `UsageLink`, `SettingsModal` and `useMobileSidebarContent` stay in the app, as they bind the router, theme and feature keys.

- [x] 18.1 `NavigationSidebar` owns the drawer shell: `isOpen`, `id`, `onClose`, fixed start-edge position with an RTL-aware slide, `inert` while closed, focus in on open and back on close, Escape. `SidebarNavigation` drops its wrapper element, refs, focus effect and key handler and keeps the route-change close. Verified by `NavigationSidebar.spec.tsx` and `SidebarNavigation.spec.tsx`.
- [x] 18.2 `ConversationListSection` joins `ConversationListHeader` and `ConversationList` with their state, exported with its types and the public class `dial-cp-list-section`; `ConversationSidebarBlock` is deleted and `ConversationPanelView` renders the section. Verified by `ConversationListSection.spec.tsx` and `ConversationPanelViewSidebar.spec.tsx`.
- [x] 18.3 READMEs of both libs document the drawer behaviour and the section; `npm run validate:docs` passes.
