## Why

### Problem

At 768–1279px, right panels consume too much space and menus still open as phone bottom sheets. Moving the global desktop boundary would also change navigation, conversation panel and forms outside the requested scope.

## What Changes

### Solution

- Introduce an independent, inclusive 768px boundary for menus and bounded tablet overlays; retain the existing 1280px layout boundary and `useIsMobile` semantics.
- Apply bounded overlay sizing to sources, attachment canvas (including project/file previews and MCP content), catalog/skill details, and standalone publication panels.
- Switch attachment/tools menus, model/deployment selectors, catalog Create and browse menus to their existing anchored desktop presentation from 768px.
- Display Catalog's normal labeled header Create button from 768px; keep the floating icon-only Create button below 768px. Other Catalog layout policies remain unchanged.
- Cover resizing, nested overlays, keyboard/focus, RTL and all five acceptance widths with automated checks.

### Non-goals

No changes to navigation or conversation-panel layout/open-state behavior, general dialogs/editors/forms, backend APIs, feature availability, or the separate chat_pg_copy repository. No new context or persistence. Preserve the existing `.mcp.json` modification.

## Capabilities

### New Capabilities

- `tablet-right-panels`: bounded overlays, size constraints and lifecycle for all right-panel families.
- `responsive-menu-presentation`: phone sheets below 768px and anchored menus from 768px, with scoped exclusions.

### Modified Capabilities

- `responsive-breakpoints`: replace the universal two-band rule with explicit surface-specific exceptions.
- `canvas`: add tablet layout and width constraints overriding its existing mobile full-width rule only in this band.
- `catalog-mobile-browse-settings`: move browse-control menu switching to 768px.
- `deployment-selector-form-trigger`: decouple picker presentation/accessibility from its host form's layout breakpoint.

## Impact

Shared libraries are intentionally affected; this is broader than an app-only CSS adjustment. Follow `libs/chat-shared/src/hooks/useIsMobile.ts:15` for media subscriptions and `libs/sidebar/src/components/SidebarPanel/SidebarPanel.tsx:25` for panel sizing/animation. Reuse existing `SideDrawer` compositions in catalog and publish-panel. App adapters (`apps/chat/src/app/app.tsx`, source/skill/publication containers) retain routes, integration callbacks and state ownership. Libraries receive presentation, widths, labels and callbacks without host contexts or storage knowledge. Existing API inputs remain supported, including other consumers such as pg-chat. No new visible strings, translation keys, backend endpoints, telemetry, cache or feature flags.

### Alternatives

| Option | Correctness / delivery risk | Security / performance | Migration / rollback |
| --- | --- | --- | --- |
| Keep current behavior | Smallest risk but fails tablet requirements | Unchanged | None |
| Move global 1280px boundary to 768px | Simple edit; breaks explicitly excluded surfaces | Broad rendering changes | Broad regression/rollback impact |
| Add independent surface policy (selected) | More call-site work; preserves layout contracts | Media-query subscriptions, no new data access | Additive APIs; scoped revert |

### Acceptance criteria

At 767px panels/menus retain current mobile behavior; at 768, 1024 and 1279px right panels overlay without changing content width, leave visible underlying content, and menus anchor to triggers; at 1280px current desktop panel behavior remains. Navigation/conversation panel stay unchanged throughout. Min/max, remembered resize values, viewport transitions, nested menus, focus restoration, scroll cleanup and RTL have automated coverage. Public API docs and breakpoint synchronization checks are updated; applicable Nx-backed checks and builds pass.

### Compatibility and rollback

Keep `mobile`/`desktop`, overlay-manager detection and `useIsMobile` unchanged. Add optional presentation inputs rather than silently changing existing `isMobile` props or every SidebarPanel. Revert the scoped call-site adoption and new policy together; no data migration is required. Implementation and behavior verification have not started.
