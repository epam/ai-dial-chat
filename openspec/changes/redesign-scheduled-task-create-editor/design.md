## Context

`ScheduledTaskCreateForm` (`libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx`) currently renders a single `flex flex-col` column: an inline header (title + Cancel/Create) followed by a `max-w-xl` stack of Display name, Description, the schedule fieldset, Model dropdown, a plain prompt `Textarea`, and a stream `DialSwitch`. `ScheduledTaskCreatePage` (`apps/chat/src/pages/ScheduledTaskCreatePage`) owns all state, validation, the `runAt`/`frequency` → BFF `trigger` mapping (`scheduled-task-trigger.ts`), and the `POST /api/v1/scheduled-tasks` call. None of that page-level logic changes here.

Product wants the create surface to look like the app's other two-column editors: a back-navigable header and a Details/Configuration split, with the free-text instructions authored in a markdown editor rather than a plain textarea.

## Goals / Non-Goals

**Goals:**

- Introduce a back-navigable header (back control + title on start, Cancel + Save on end) and a two-column Details/Configuration body, responsive per project breakpoints.
- Swap the prompt `Textarea` for `DialMarkdownEditor` (`@epam/ai-dial-ui-kit`), keeping `values.prompt` / `onFieldChange('prompt', …)` as the binding — no BFF field rename.
- Keep every existing field, its validation, and the required-field guard behaviorally identical; only their container/layout and (for the prompt) editor widget change.
- Keep the lib free of routing/i18n/host imports; `onBack` is a plain callback like `onCancel`.

**Non-Goals:**

- No Skill picker, no schedule redesign (Repeat/Start/End date pickers), no `scheduled-task-trigger.ts` changes.
- No BFF/OpenAPI changes. No changes to list page, routing table, feature flag, or edit (`PUT`) flow.
- No new client-side validation rules beyond what exists today.

## Decisions

**1. `onBack` as a new required prop, not a repurposed `onCancel`.**
The header needs two independent affordances (back chevron, and a Cancel button) that both currently map to "discard and return to `returnUrl`". Rather than overload `onCancel` for both places it's rendered, add `onBack: () => void` to `ScheduledTaskCreateFormProps` alongside the existing `onCancel`. `ScheduledTaskCreatePage` passes the same handler to both. This keeps the lib's contract explicit about "there are two controls" without encoding page-navigation semantics (e.g. "this navigates") into the lib itself — the lib just knows it has a back control and a cancel button, each firing its own callback.
_Alternative considered:_ collapse back-chevron's `onClick` directly to `onCancel` and skip the new prop. Rejected — the spec explicitly asks for a distinct `onBack` prop so the app can differentiate telemetry/behavior later without a lib change, and the header/chevron is structurally a distinct control from the Cancel button.

**2. Rename `promptLabel` → `instructionsLabel`, don't dual-write.**
Since `libs/scheduled-tasks` has no external consumers besides `apps/chat` (single monorepo, no published package boundary to preserve), rename directly instead of keeping both keys. Add four new section-heading label fields (`detailsSectionTitle`, `detailsSectionSubtitle`, `configurationSectionTitle`, `configurationSectionSubtitle`) and rename `createButtonLabel` usage to display "Save" text (the prop name `createButtonLabel` stays — only the string the page passes in changes to `ButtonsI18nKeys.Save`), since the prop still gates the same create submit action.
_Alternative considered:_ keep `promptLabel` and add `instructionsLabel` as an alias. Rejected as needless indirection — single consumer, no migration window needed.

**3. Two-column layout via CSS Grid with Tailwind logical/responsive utilities, not a new layout primitive.**
`grid grid-cols-1 desktop:grid-cols-3 gap-6` (Details spans 1 column, Configuration spans 2) matches the "~1/3 + ~2/3" spec without inventing a new shared layout component — this is a single-use page layout, not a reusable pattern yet. `useIsMobile` is only needed if a field must render conditionally different markup (not required here — CSS Grid alone handles the stack-vs-columns switch).
_Alternative considered:_ a shared `TwoColumnEditorLayout` component in `libs/chat-shared`. Rejected as premature abstraction — no second consumer yet; revisit if a second editor page needs the same shell.

**4. `DialMarkdownEditor` CSS import lives in the app entry, once.**
Per the ui-kit's own README pattern (`@uiw/react-markdown-preview/markdown.css`, `@uiw/react-md-editor/markdown-editor.css`), these are global stylesheets loaded once for the whole app, added to `apps/chat/src/main.tsx` (co-located with the existing global CSS imports), not per-component — importing per-component would duplicate the stylesheet injection every time the create page mounts.

**5. Schedule fieldset moves into the Details column unchanged.**
The existing `<fieldset>` (schedule type segmented control, run-at/frequency/time/day inputs) is relocated as-is into the Details column's JSX; its internal structure, labels, and validation wiring are untouched — only the surrounding container changes.

## Risks / Trade-offs

- **[Risk]** Renaming `promptLabel` → `instructionsLabel` and adding `onBack` are breaking changes to `ScheduledTaskCreateFormProps`/`ScheduledTaskCreateFormLabels`. → **Mitigation**: single in-repo consumer (`ScheduledTaskCreatePage`); update it in the same change, verified by `nx test`/`nx lint` on both `@epam/ai-dial-scheduled-tasks` and `chat`.
- **[Risk]** `DialMarkdownEditor`'s prop API is unconfirmed at proposal time. → **Mitigation**: tasks.md requires calling ui-kit MCP `getEntityDetails("component", "DialMarkdownEditor")` before wiring it, and checking `CHANGELOG.md`/migration guides if the installed `@epam/ai-dial-ui-kit` version differs from what's assumed.
- **[Risk]** Global markdown CSS imported at app entry could visually affect other markdown surfaces in the app (e.g. chat message rendering) if class names collide. → **Mitigation**: verify visually (dev server) that existing markdown-rendered chat content is unaffected after the import is added; these are scoped `@uiw/*` stylesheets used elsewhere in the ui-kit already if any other page uses `DialMarkdownEditor` — check for an existing import first to avoid a duplicate.
- **[Trade-off]** Keeping `onCancel` and `onBack` as two separate callbacks (both wired to the same page handler) is slightly redundant at the call site, but keeps the lib's prop contract explicit and avoids the page having to know which UI element triggered "cancel".

## Migration Plan

Single-PR change, no data migration. Sequence: (1) extend lib props/labels + JSX layout + markdown editor, (2) update lib tests, (3) wire `ScheduledTaskCreatePage` + i18n keys + app-entry CSS import, (4) update page tests, (5) manual desktop/mobile/RTL verification. Rollback is a plain revert — no persisted state or API contract is touched.

## Open Questions

- Exact visual spacing/breakpoint values (gap size, min column width) — left to implementation to match nearest existing two-column editor page for visual consistency; no numeric spec value is prescribed here.
- Whether `description`'s label should show a required asterisk — proposal defaults to **optional** (matches BFF); no product confirmation needed to proceed.
