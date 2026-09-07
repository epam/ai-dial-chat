## ADDED Requirements

### Requirement: Public package surface
`libs/editor-builder/src/index.ts` SHALL export `EditorLayout`, `EditorSection`, and every TypeScript type reachable through their props: `EditorLayoutProps`, `EditorLayoutLabels`, `EditorLayoutStyles`, `EditorSectionProps`, `EditorSectionStyles`. Internal-only helpers SHALL NOT be exported from the barrel. The package `libs/editor-builder/package.json` SHALL declare `name: "@epam/ai-dial-editor-builder"` with `description`, `license: "Apache-2.0"`, an `exports` map matching `libs/prompt-editor/package.json`'s shape (source/types/import/default for `.`, plus `./package.json`), and peer dependencies on `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, and `@tabler/icons-react`.

#### Scenario: Consumer imports the library's public surface
- **WHEN** a consumer writes `import { EditorLayout, EditorSection, EditorLayoutProps, EditorLayoutLabels } from '@epam/ai-dial-editor-builder'`
- **THEN** the import resolves successfully and every named type is defined

#### Scenario: Internal helper is not part of the public surface
- **WHEN** code outside `libs/editor-builder` attempts to import an unexported internal helper from `@epam/ai-dial-editor-builder`
- **THEN** the import fails to resolve, since the barrel does not re-export it

### Requirement: No host, routing, i18n, or API dependency
`libs/editor-builder/src/**` SHALL NOT import `react-i18next`, `i18next`, `react-router`, `react-router-dom`, any module under `apps/chat/src`, `@epam/ai-dial-chat-api-client`, or any environment/feature-flag/analytics module. All user-visible strings SHALL be supplied via `labels` props with English-language defaults.

#### Scenario: No i18n import
- **WHEN** `libs/editor-builder/src/**` is searched for `react-i18next`/`i18next` imports
- **THEN** none are found; all copy is passed via `labels` props

#### Scenario: No routing import
- **WHEN** `libs/editor-builder/src/**` is searched for `react-router` imports
- **THEN** none are found; back-navigation is exposed only via `onBack` callback prop

### Requirement: EditorLayout — header row
`EditorLayout` SHALL render a sticky header row containing:
- A `GhostIconButton` with a left-arrow icon on the inline-start side, labelled by `backAriaLabel` (English default `'Back'`), that calls `onBack` when clicked
- A `title` text rendered as an `h1` heading element
- An `actions` ReactNode slot on the inline-end side, rendered as-is (the host supplies the actual `GhostButton` / `PrimaryButton` instances)
- A `role="status"` aria-live polite SR-only region that announces `labels.savingStatusLabel` (default `'Saving'`) when `isSaving` is `true` and an empty string otherwise

The header row SHALL be visible at all viewport widths (no `desktop:` visibility toggle inside `EditorLayout` itself). The back arrow icon SHALL carry `rtl:scale-x-[-1]` so it mirrors in RTL layouts.

#### Scenario: Back button calls onBack
- **WHEN** a user clicks the back-arrow button in the header
- **THEN** `onBack` is called exactly once

#### Scenario: Actions slot renders host content
- **WHEN** the host passes `actions={<><GhostButton label="Cancel" /><PrimaryButton label="Save" /></>}`
- **THEN** those two buttons appear in the header's inline-end area

#### Scenario: Saving status is announced
- **WHEN** `isSaving` transitions to `true`
- **THEN** the `role="status"` region's text becomes the `savingStatusLabel` value and screen readers announce it

#### Scenario: Back arrow mirrors in RTL
- **WHEN** `EditorLayout` renders inside a `dir="rtl"` ancestor
- **THEN** the back arrow icon visually points in the reading-direction-correct "back" direction

### Requirement: EditorLayout — two-column responsive body
`EditorLayout` SHALL render its body as a two-column layout on desktop and a single stacked column on mobile:

- **Desktop** (≥ `desktop` breakpoint): `leftContent` occupies a fixed 360 px column on the inline-start side; `rightContent` (when provided) occupies the remaining `flex-1` space, separated by a `border-e` divider. Both columns are independently scrollable via `overflow-y-auto` on the outer body container.
- **Mobile** (below `desktop` breakpoint): `leftContent` renders first (top), `rightContent` renders below it; both span full width. The body container is a single scrollable column.
- When `rightContent` is absent or `undefined`, `leftContent` expands to full width at all viewport sizes.

#### Scenario: Two columns on desktop
- **WHEN** `EditorLayout` renders with both `leftContent` and `rightContent` at ≥ desktop width
- **THEN** the two panels appear side by side, separated by a vertical divider

#### Scenario: Single column on mobile
- **WHEN** `EditorLayout` renders with both `leftContent` and `rightContent` at < desktop width
- **THEN** the two panels stack vertically, `leftContent` on top

#### Scenario: Single-panel mode
- **WHEN** `rightContent` is absent
- **THEN** `leftContent` fills the full available width at all viewport sizes

### Requirement: EditorSection — visual section wrapper
`EditorSection` SHALL render a bordered/card visual region with:
- An optional `title` string rendered as a section heading
- `children` rendered verbatim inside the card body
- Optional `styles?: EditorSectionStyles` for color/typography overrides (following the same `buildCssVars` pattern as other libs)

`EditorSection` SHALL own no state and contain no interactive controls of its own.

#### Scenario: Title renders when provided
- **WHEN** `<EditorSection title="Metadata">…</EditorSection>` renders
- **THEN** the heading "Metadata" appears above the children content

#### Scenario: No title renders when absent
- **WHEN** `<EditorSection>…</EditorSection>` renders without a `title`
- **THEN** no heading element appears and only the children are visible

### Requirement: RTL and accessibility
`EditorLayout` and `EditorSection` SHALL use CSS logical properties (`padding-inline-start/end`, `margin-inline-start/end`, `border-inline-start/end`) and Tailwind logical utilities (`ps-*`, `pe-*`, `ms-*`, `me-*`, `border-s-*`, `border-e-*`) for all directional spacing. The back-arrow icon SHALL carry `aria-hidden`; its accessible name comes from `GhostIconButton`'s `aria-label`. The `title` heading SHALL be an `h1`. The `actions` slot content is owned entirely by the host and is not wrapped in any additional landmark by `EditorLayout`.

#### Scenario: No physical direction Tailwind classes
- **WHEN** `libs/editor-builder/src/**` is searched for `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `border-l-`, `border-r-`, `text-left`, `text-right`
- **THEN** none are found (except where an explicit `rtl:` counterpart is placed alongside)

#### Scenario: Back icon is aria-hidden
- **WHEN** `EditorLayout` renders
- **THEN** the `IconArrowLeft` inside the back button carries `aria-hidden`, and the button's accessible name comes from `aria-label={backAriaLabel}`
