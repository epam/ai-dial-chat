## Context

Post-archive update: at the user's request, the task-specific browser suite and its Nx target were removed. Browser verification described below records the implementation-time checks; unit tests and product behavior remain in place.

The current `responsive-breakpoints` spec explicitly requires mobile presentation on every surface below 1280px. This change supersedes that universal rule only for the enumerated surfaces. The existing 767px Scheduled Tasks search-focus exception remains. `canvas` also documents physical-right anchoring; retain that existing desktop/phone behavior and use logical inline-end placement for the new tablet overlay, documenting the scoped distinction.

### Inspected surface inventory

Paths below are relative to the repository root. Shared implementations include every composition, not only their primary page.

| Family | Implementation / consumers | Treatment |
| --- | --- | --- |
| Sources | `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`; `libs/source-panel/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` | Tablet overlay through SidebarPanel; current source width preserved then clamped |
| Attachment canvas | `apps/chat/src/app/app.tsx`; `apps/chat/src/utils/canvas-width.ts`; `libs/attachment-canvas/src/components/AttachmentCanvasContainer/AttachmentCanvasContainer.tsx`; `libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx` | All app-mounted conversation, file-manager and project previews; all content types including MCP; desktop 600px minimum and file-manager 400px minimum cannot override tablet cap |
| Catalog details | `libs/catalog/src/components/Details/DetailsPanel.tsx` and its SCSS | Existing SideDrawer: size override only; includes nested publication, credentials, confirmations and content previews |
| Skill details | `libs/skills/src/components/SkillDetailsSidePanel/SkillDetailsSidePanel.tsx`; `apps/chat/src/components/SkillSelector/SkillDetailsPanelContainer.tsx` | Inherits catalog drawer behavior in composer, message editing and application preview |
| Publish conversation/project | `libs/publish-panel/src/components/PublishPanel/StandalonePublishPanel.tsx`; app `PublishConversationPanelContainer` and `PublishProjectPanelContainer` | Existing SideDrawer; bounded tablet width, unchanged form contents |
| Shared shell | `libs/sidebar/src/components/SidebarPanel/SidebarPanel.tsx`, its SCSS and `libs/sidebar/src/models/panel-props.ts` | Explicit opt-in for bounded overlay; left ConversationPanel and legacy isOverlay default unchanged |
| Attachment/tools/add-on menus | `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx` | Split menu decision from settings/editor presentation; tools and add-on pickers use existing desktop flyouts at 768px |
| Model selector | `libs/conversation-input/src/components/Input/Input.tsx`; `libs/conversation-input/src/components/Input/ModelSelectorControl.tsx` | Pass menu-specific boolean; retain Input's layout boolean |
| Form deployment selector | `apps/chat/src/components/DeploymentSelector/DeploymentSelectorFieldTrigger.tsx`, `DeploymentSelectorPanel.tsx` | Match popover selection, ARIA and initial-focus branch to 768px |
| Catalog Create | `libs/catalog/src/components/Catalog/Catalog.tsx`; `libs/catalog/src/components/Catalog/CreateButton.tsx` | Normal labeled header button and anchored menu from 768px; floating icon-only button and sheet below 768px |
| Catalog browse | `libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`, `BrowseSettingsSheet.tsx` | View/sort/filter controls use existing desktop controls at 768px; retain page grid/gutters/modal layout |
| Existing anchored menus | Other Dropdown/ButtonDropdown usages | Keep anchored presentation; no blanket component replacement |
| Excluded sheets/layouts | NavigationSheet, NavigableBottomSheet, SidebarNavigation, ConversationPanel; SkillEditorDialog, CatalogModal, ChatSettingsBottomSheet, general forms | Keep existing presentation policy; switching a menu does not switch its destination editor or dialog |

No independent MCP right-panel shell was found: MCP content uses attachment canvas. No per-library AGENTS.md files were found; root rules and apps/chat/AGENTS.md apply.

## Goals / Non-Goals

Goals: deterministic 768px menu policy; bounded tablet right overlays; unchanged 1280px layout semantics; reusable library APIs; automated boundary and lifecycle verification.

Non-goals: navigation/conversation-panel redesign, global desktop migration, changes in downstream repositories, dependency upgrades, new backend/state providers or persistence.

## Decisions

### 1. Separate responsive policies

Add `TABLET_BREAKPOINT_PX = 768`, `PHONE_MEDIA_QUERY` (`width < 768px`) and `TABLET_MEDIA_QUERY` (`768px <= width < 1280px`) beside the current constants. Export `useIsPhone` and `useIsTablet` using the existing media-subscription pattern (SSR-safe initialization, change subscription, cleanup). These are planned additions. Existing `useIsMobile` remains the layout signal; callers never use `window.innerWidth` to choose presentation. Existing viewport measurement utilities can still supply numerical sizing.

Add explicit `phone`, `tablet`, and `tablet-up` custom variants to `tools/tailwind/theme.css` only for adopted surfaces. Preserve `mobile`/`desktop`; do not introduce sm/md/lg or the deprecated tablet variant names. Synchronization tests pin both policy families and any SCSS mirrors, including fractional widths immediately below boundaries. Update responsive guidance during implementation to describe this authorized exception.

### 2. Keep panel layout and ownership explicit

Add an optional bounded-overlay presentation input to SidebarPanel and forward it through source-panel and attachment-canvas APIs. Keep existing `isMobile`, `isOverlay` and omitted-input behavior for external consumers. The parent app opts right panels into the new presentation; left panels receive no new input. Existing isOverlay forces `w-full` and leaves positioning to the host, so using it unchanged is insufficient.

Host containers own placement, route-specific defaults and existing open/close state. Retain AttachmentCanvasContext, existing source-panel ownership, catalog selection and publication state. Do not introduce a global panel provider. Keep sources/canvas mutual exclusion and navigation state intact. Generic clamping belongs in a host-agnostic utility; route and persistence decisions remain in the app. Library code imports no app contexts, generated client, routes, feature flags, environment, storage keys or telemetry transports.

### 3. Width contract

Use the current per-panel preferred width, not a single universal width. Proposed reviewable spacing choice: reserve **32px** of visible underlying content at tablet widths. For available inline width A, cap C = max(0, A - 32px), effective maximum U = min(configured maximum, C), effective minimum L = min(configured minimum, U), and effective width clamp(preferred or user-selected width, L, U). Normalize invalid min/max ordering before applying. A cannot exceed viewport width and must account for a narrower embedding container. Apply the same bounds to the outer wrapper, animated width, inner resizable container and drag result.

Retain existing resizability where supported, including keyboard resize; non-resizable drawers stay non-resizable. Keep a user's desktop preferred width separately from the rendered clamped width; a viewport-only clamp does not overwrite that preference or trigger host persistence. Returning to desktop restores it within desktop bounds. Preserve current close/reset semantics; do not add session storage. Desktop defaults (including canvas route-specific calculations) are unchanged.

Tablet overlays are out of flow and anchored with logical inline-end properties. Page content dimensions do not change when opening/closing them. Drawer backdrops do not make the panel itself full-width. Reuse existing SideDrawer modal/focus/backdrop mechanics; preserve SidebarPanel's complementary/non-modal semantics, add Escape/focus restoration without globally trapping focus or locking page scroll. A menu inside a drawer stays in its focus scope and above its content; Escape closes the innermost layer first. A newly opened modal drawer manages focus above an existing canvas without silently closing unrelated panels.

### 4. Menu migration is narrower than layout migration

Use `useIsPhone` at sheet/dropdown branch points and for Catalog Create placement. Split overloaded booleans in Input and AddAttachmentButton; chat settings destinations and full catalog/editor dialogs still follow their original policies. Browse settings are a view/sort/filter menu surface and are included. Catalog grids, gutters and host form layout remain under existing policies.

Catalog Create is an explicitly requested additional exception: from 768px render the normal labeled button in the page header; below 768px retain the floating icon-only button at the bottom inline-end. Keep one mounted CreateButton while changing placement so open-menu and search state survive viewport transitions. Only phones reserve bottom content padding and stack Scroll to top above Create. Preserve hideCreateButton, read-only behavior, host labels/actions and hidden page titles. A standalone CreateButton's explicit isFloating prop remains supported for other consumers.

For an already-open menu crossing 768px, preserve logical open state, committed selections and query where its trigger remains available; remount exactly one presentation and focus its equivalent active item/search. When browse controls replace the phone settings trigger, close the old sheet, discard uncommitted filters and focus the corresponding desktop control (or phone settings trigger in reverse). Never leave sheet scroll locks/backdrops behind. Changing 1280px must not force menus back into a sheet.

### 5. Accessibility, styling and contracts

Retain translated labels, role semantics, keyboard navigation, trigger anchoring, viewport collision handling, live announcements and focus-return targets. New geometry uses logical properties and direction-aware resize edges; icons follow RTL rules. Respect reduced motion. Preserve loading/error/empty states and draft data during breakpoint changes. No new text, keys, flags, backend endpoints, caching or analytics are required. Reuse memoized derived values/callbacks where passed to memoized components; no new context-value memoization is needed.

Use ui-kit MCP discovery before changing kit integrations; those tools were unavailable during proposal preparation, so no unverified kit API is prescribed. Keep existing public composition hooks; do not inspect/override private kit DOM or change package versions to obtain this behavior.

## Risks / Trade-offs

- Shared SidebarPanel serves left panels → opt-in API and unchanged-default regression tests.
- Clamp mismatch between wrapper/resizer produces overflow → one effective bounds calculation and real-browser geometry assertions.
- CSS/JSDOM cannot prove overlay geometry or focus traps → automated browser coverage at all acceptance widths, not only mocked media tests.
- Nested modal and menu portals may escape focus scopes → reuse existing kit composition and verify Escape, focus return and scroll cleanup.
- Current canvas spec uses physical right → explicitly limit logical anchoring change to the new tablet mode; retain desktop/mobile placement.
- Existing specs use mobile/desktop ambiguously → responsive-breakpoints becomes authoritative for the scoped menu terms; explicitly modify catalog browse and deployment focus requirements.
- Concurrent catalog work exists (`add-catalog-picker-scroll-to-top`, `catalog-add-on-picker`) → preserve those changes and their tests; no modifications to their planning artifacts.

## Migration Plan

Deliver verified vertical slices: source panel plus policy/shell, other right panels, then menus; update public README contracts and responsive architecture documentation. Run Nx-backed per-file and per-slice checks, one final full check, affected build and docs/spec validation. Roll back the adoption and new policy together; no data migration. Existing signatures remain source-compatible and other hosts can opt into the panel mode without routes or app providers.

## Open Questions

No blocking product questions. The 32px exposed-content allowance is an explicit design assumption. UI-kit portal/focus support and available browser test target must be checked during the focused implementation steps; neither was behavior-tested during this proposal. Nx project discovery succeeded through the local CLI; Nx MCP was unavailable.

### Implementation verification alignment

The browser suite follows the existing apps/chat/browser-tests Node/Playwright convention instead of putting a browser spec in the Vitest source tree. It reuses the app's existing PDF CSS alias. The installed Playwright browser bundle is absent on this machine, so local validation uses the installed Chrome via PLAYWRIGHT_CHANNEL=chrome; CI can use bundled Chromium. Drawer geometry is tested in the real browser, with existing DetailsPanel unit tests retained for behavior rather than adding a CSS-class-only unit test.

The canvas width resolver keeps its desktop/mobile contract; App supplies the scoped tablet policy at the call site. Host deployment-picker hooks own the controlled search across presentation remounts. The optional `Input.onModelPickerOpenChange` callback clears host search on actual dismissal without adding app knowledge to the library. The bounded sidebar keeps its resize hit area unclipped, including the physical RTL resize edge exposed by the existing kit API.

Final review fixes keep the active Tools/add-on submenu in AddAttachmentButton across phone/tablet remounts. The installed kit's MCP documentation exposes no controlled state for item `children` submenus, so the attachment menu composes controlled Dropdowns and MenuItems through public `renderOverlay` slots. The component supplies keyboard navigation, logical flyout direction and innermost Escape handling; host add-on query state stays with the host. No kit DOM inspection or dependency update is needed. Catalog uses a ref to the phone Browse settings trigger and a scoped desktop view-control target, excluding the search clear button and host-rendered header controls from focus restoration.
