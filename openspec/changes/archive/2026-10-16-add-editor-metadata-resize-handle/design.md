# Design

## Context

`EditorLayout` (`libs/builder-form/src/components/EditorLayout/EditorLayout.tsx`) renders the body as a flex row on desktop: the left column is `desktop:w-[400px] desktop:shrink-0 desktop:border-e` when a center column exists, the center column is `flex-1`. `EntityEditor` composes it and is used by the application editor (`ApplicationFormEditor`) and by the Prompt, Skill and Toolset editor libs. `libs/*` must stay host-agnostic (no i18n, storage, routing), so width ownership and strings must come from the app. Breakpoints are the project's `mobile`/`desktop`; JS branching uses `useIsMobile` from `apps/chat/src/hooks/breakpoint/useBreakpoint.ts`, which a lib cannot import, so the handle is hidden by CSS (`hidden desktop:block`).

## Goals / Non-Goals

**Goals:**
- Live, accessible, RTL-correct drag-to-resize of the left column in `EditorLayout`, opt-in per host.
- Host-controlled width so the app persists it without the lib knowing about storage.

**Non-Goals:**
- Resizing the aside column, mobile/tablet resizing, other editors, a general-purpose splitter lib.

## Decisions

1. **Controlled props, lib keeps only drag state.** `resizableLeftColumn: { width, onWidthChange, defaultWidth?, minWidth?, maxWidth? }`. Absent means today's layout, so Prompt/Skill/Toolset are untouched. Alternative: uncontrolled with `defaultWidth` and an `onChange` — rejected, the host needs the value to hydrate from storage.
2. **Inline size via a CSS custom property.** The left column gets `style={{ '--el-left-width': `${w}px` }}` and `desktop:w-[var(--el-left-width)]`, so the width applies only at desktop and stacked mobile columns keep full width (an inline `width` would leak into mobile). Follows the existing `buildCssVars` convention in the same file.
3. **Internal `ResizeHandle` component** (`libs/builder-form/src/components/EditorLayout/ResizeHandle.tsx`, not exported from the barrel). It renders an 8 px absolutely positioned hit area on the inline-end edge of the left column (`absolute inset-y-0 end-0 -me-1 w-2`, replacing the column's `border-e` with a 1 px inner line), `hidden desktop:block`.
4. **Pointer handling.** `onPointerDown` captures the pointer, records start x and start width; `onPointerMove` computes `delta = (clientX - startX) * (isRtl ? -1 : 1)`, where `isRtl` comes from `getComputedStyle(container).direction`, so it follows the cascade rather than a lib-side language check; `onPointerUp`/`Cancel` release. `user-select: none` is applied to the body container while dragging. A `requestAnimationFrame` coalesces moves so only one `onWidthChange` fires per frame.
5. **Clamping** is a pure function `clampLeftColumnWidth(width, { min, max, containerWidth, minCenterWidth })` with defaults 280/640/360, kept in `libs/builder-form/src/utils/` and unit tested. The container width is read from a ref at drag/keyboard time; the rendered width is clamped on every render, and a `ResizeObserver` re-clamps when the window shrinks so the center column never overflows.
6. **Keyboard / a11y.** `role="separator"` with `aria-orientation="vertical"`, `aria-valuenow/min/max`, `aria-label`, `tabIndex={0}`. Arrow keys ±16 px mirrored in RTL, Home/End → min/max, double-click → `defaultWidth`. A visible focus ring uses the accent token. The tooltip is a UI-kit `Tooltip` (`asChild` on the handle, so `aria-describedby` lands on the control) with a 1000 ms open delay; the exact delay prop is confirmed with `getEntityDetails` at apply time, with a local timer as the fallback. The tooltip never carries the accessible name; `aria-label` does.
7. **Visual states** use design tokens via CSS module classes in `EditorLayout.module.scss` (default: divider token; hover and dragging: accent; active: pressed accent), exposed through the existing `--el-sidebar-border-color` override and one new optional `--el-resize-handle-color` variable. The 1 s hover delay is a CSS `transition-delay` on the line color, with the cursor applied immediately.
8. **App wiring.** `ApplicationFormEditor` calls `useLocalStorage<number>(KEY, 400)` and passes `resizableLeftColumn` and `labels.resizeHandleLabel/Tooltip` (from new `EditorI18nKeys.ResizeHandleAriaLabel` / `ResizeHandleTooltip`). The storage key follows the existing key constants convention in `apps/chat/src/constants/`. Non-finite stored values are sanitised before use.
9. **Spec home.** The issue's `application_editor-layout` spec does not exist; deltas go to `builder-form` (library behaviour) and `app-editor-flow` (page behaviour).

## Risks / Trade-offs

- **Shared lib change:** opt-in prop and unchanged defaults limit regression risk; existing `EditorLayout` and `EntityEditor` tests must stay green unmodified.
- **Persisting on every pointer move** would hammer `localStorage`; the app persists via the hook per call, so coalescing with rAF (decision 4) keeps writes to one per frame. If that proves noisy, the host can debounce in the callback, with no lib change.
- **Assumed numbers** (280/640/360, 1 s tooltip, double-click reset) come from open questions in the issue and are single constants, easy to retune after design review.
- **Touch:** below the desktop breakpoint the handle is absent, so there is no touch-drag work; tablets in landscape at desktop width get pointer events, which cover touch.

## Follow-up: handle moved to the UI kit

Decision 3's internal `ResizeHandle` was moved into `@epam/ai-dial-ui-kit` as the 2.0 `ResizeHandle` (epam/ai-dial-ui-kit#955, PR epam/ai-dial-ui-kit#956), so other hosts share one implementation. `libs/builder-form` no longer contains `ResizeHandle.tsx` or its styles and imports the component from the kit.

- **API:** the kit component is controlled (`width`, `minWidth`, `maxWidth`, `defaultWidth`, `onWidthChange`, `label`, `tooltip`, `keyboardStep`, `className`). It has no `containerRef`; `EditorLayout` keeps `clampLeftColumnWidth` and passes the container-limited `maxWidth`, so `aria-valuemax` now reports the effective limit. Direction is read from the handle's own element.
- **Unchanged:** drag, keyboard, double-click reset, RTL mirroring, the 1 s rest delay and the themed cursor. The `EditorLayout` and `EntityEditor` specs pass unmodified.
- **Host-side:** the `hidden desktop:block` visibility stays in `EditorLayout` (the wrapper around the handle). The unused `--el-resize-handle-color` override is dropped; the kit colors the line from its border tokens.
- **Dependency:** `@epam/ai-dial-ui-kit` `^0.16.0-dev.22`, the first dev release that exports `ResizeHandle`.
