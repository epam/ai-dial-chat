## Why

The current `ScheduledTaskCreateForm` is a single narrow column with in-page Cancel/Create actions and a plain textarea for the prompt. Product wants the create experience realigned with the app's editor pattern — a back-navigable header and a two-column Details/Configuration layout with a markdown instructions editor — without touching schedule logic, the BFF contract, or introducing Skills.

## What Changes

- Replace the single-column form chrome with a full-width header: back control (chevron, RTL-mirrored) + page title on the start side, Cancel + Save on the end side. Save keeps the existing submit/create behavior; a new `onBack` prop navigates like Cancel (no network call).
- Replace the single-column body with a responsive two-column layout: **Details** (left, ~1/3 on desktop) and **Configuration** (right, ~2/3 on desktop); stacked full-width on mobile using project breakpoints (`mobile`/`desktop`, `useIsMobile` where JS branching is needed).
- **Details** column: Name (required), Description (optional, unchanged validation), Model or Agent (required, relabeled), and the existing Schedule controls (once/recurring, frequency/time/day) carried over unchanged — no schedule redesign (no Repeat/Start date/End date pickers).
- **Configuration** column: replace the prompt `Textarea` with `MarkdownEditor` from `@epam/ai-dial-ui-kit`, bound to the existing `values.prompt` field; import the ui-kit's markdown editor CSS once at the `apps/chat` entry.
- Extend `ScheduledTaskCreateFormLabels` with section/header i18n keys (`detailsSectionTitle`, `detailsSectionSubtitle`, `configurationSectionTitle`, `configurationSectionSubtitle`, `instructionsLabel`) and rename `promptLabel` → `instructionsLabel`; add `onBack: () => void` to the component's props.
- Wire `ScheduledTaskCreatePage` to pass `onBack` (same target as `onCancel`: navigate to `returnUrl`) and the new i18n strings; no submit/validation logic changes beyond label renames.
- **BREAKING** (lib-internal only): `ScheduledTaskCreateForm` prop/i18n contract changes (`onBack` added, `promptLabel` renamed to `instructionsLabel`) — no BFF or route contract changes.

### Explicitly out of scope

- Skill picker / skill-backed instructions (no UI, no API, no placeholder).
- Schedule redesign (Repeat dropdown, Start/End date range) or any change to `scheduled-task-trigger.ts` mapping.
- BFF/OpenAPI changes, list cards, routing, feature flag, nav, edit flow (`PUT`), overflow menu, pagination.
- Stream toggle: if the target layout has no visible control for it, omit the `DialSwitch` but keep submitting `stream: true` by default.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `scheduled-task-create-form`: replace the single-column layout requirement with a two-column Details/Configuration layout, a back-navigable header with Cancel/Save actions, and a markdown-editor-based Instructions field replacing the plain prompt textarea; update the lib component contract (`onBack` prop, `instructionsLabel` i18n key) and i18n scenario keys.

## Impact

- `libs/scheduled-tasks/src/lib/ScheduledTaskCreateForm/*` — layout, labels type, and props change.
- `apps/chat/src/pages/ScheduledTaskCreatePage` (or equivalent) — wiring for `onBack`, new i18n strings.
- `apps/chat/src/i18n/locales/en.json` — new/renamed `scheduledTasks.create.*` keys.
- `apps/chat` entry (main/layout) — one-time import of `MarkdownEditor` CSS.
- Tests: `ScheduledTaskCreateForm.spec.tsx`, `ScheduledTaskCreatePage.spec.tsx`.
- No changes to `apps/chat-api`, OpenAPI contract, or `scheduled-task-trigger.ts` mapping.
