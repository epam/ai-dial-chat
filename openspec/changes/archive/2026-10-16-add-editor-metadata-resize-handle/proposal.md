# Proposal

## Why

In the Create/Edit application editor (epam/ai-dial-quickapps-frontend#201) the Metadata column on the left is a fixed 400 px (`desktop:w-[400px]` in `libs/builder-form/src/components/EditorLayout/EditorLayout.tsx`). Long descriptions are cramped, while users who work mostly in Setup (Instruction, Add-ons, …) cannot reclaim the space. A drag handle on the column boundary lets users trade width between the two.

## What Changes

- `EditorLayout` (and `EntityEditor`, which composes it) gain an **opt-in** resizable left column: a vertical separator handle on the Metadata/Setup boundary, rendered only at the `desktop` breakpoint when the column is paired with a center column.
- The handle has a thin visible line with an 8 px hit area, a default / hover (after a 1 s rest) / active / dragging visual state set, a "Drag to resize" tooltip, `col-resize` cursor, pointer drag, keyboard (←/→, Home/End) and double-click-to-reset.
- Width is **controlled by the host** through props (`resizableLeftColumn.width`, `onWidthChange`, min/max/default). The lib holds only transient drag state and never touches storage.
- `ApplicationFormEditor` enables it, persists the chosen width in `localStorage` through the existing `useLocalStorage` hook, and supplies the translated tooltip / aria strings.
- Prompt, Skill and Toolset editors (also `EntityEditor` consumers) are unchanged: the feature is off unless the host passes the props.

### Assumptions (the issue lists these as open questions — confirm or correct before apply)

1. **Persistence:** the width is remembered across editor opens (`localStorage`, app-level), not reset each time.
2. **Scope:** only the Metadata column is resizable; the Setup column takes the remainder. The optional aside column stays fixed at 400 px.
3. **Limits:** default 400 px (today's value), min 280 px, max 640 px, additionally capped so Setup keeps at least 360 px. The Figma frame `QuickApp_Resized_Metadata_MIN` was not accessible while planning; adjust the constants if it differs.
4. **Double-click** on the handle resets to the default width.
5. **Editors:** enabled for every `ApplicationFormEditor` definition (Quick App, Custom App, Schema App), as they share one page; the issue only names Quick App.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `builder-form`: `EditorLayout`/`EntityEditor` gain an optional, host-controlled, resizable left column with an accessible separator handle.
- `app-editor-flow`: the application editor page enables the handle, persists the width and supplies localized strings.

The issue names `application_editor-layout`, but no such spec exists. The Quick App editor layout is owned by `app-editor-flow` and the shared layout by `builder-form`.

## Alternatives considered

- **Custom pointer-based handle in `EditorLayout` (chosen).** `@epam/ai-dial-ui-kit` has no resizable/splitter primitive (`searchEntity` finds none). A new dependency such as `react-resizable-panels` is heavier than roughly 100 lines for one handle and would need its own RTL/a11y work.
- **CSS `resize: horizontal`.** No separator semantics, no keyboard, no tooltip, poor RTL; rejected.
- **Lib-owned persistence.** Violates library isolation (storage keys belong to the host); rejected in favour of controlled props.

## Impact

- **Code:** `libs/builder-form` (`EditorLayout`, `EntityEditor`, a new internal `ResizeHandle` component, models, `README.md`), `apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`, `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/en.json`.
- **Libs boundary:** no i18n, storage or routing in the lib; strings, width and persistence arrive as props/callbacks from the app. This is a shared-lib change, so scope creep is limited by the opt-in default.
- **i18n:** new strings — handle tooltip ("Drag to resize") and handle aria-label, under the existing `editor.*` keys.
- **RTL:** logical properties; drag delta and arrow keys mirrored under `dir="rtl"`.
- **API / backend / feature flags:** none. No new chat-api requests; form state and save behaviour untouched.
- **Backward compatibility / rollback:** purely additive and off by default. Revert by dropping the props at the `ApplicationFormEditor` call site; a stale `localStorage` entry is harmless.

## Non-goals

Resizing the aside column, resizing on mobile/tablet, resizing other editors, server-side persistence.

## Acceptance criteria

Those of the issue: live drag with no horizontal scroll, clamped width, state visuals, localized tooltip, RTL, `role="separator"` semantics with keyboard control, hidden below the desktop breakpoint, no new requests and unchanged form/save behaviour.
