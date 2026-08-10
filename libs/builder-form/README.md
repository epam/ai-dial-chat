# @epam/ai-dial-builder-form

## Overview

Presentational building blocks shared by DIAL's builder/editor form pages — the surfaces where a user composes or edits an entity (a scheduled task, a deployment, an agent) through a titled page with a back control and cancel/submit actions. Extracting these blocks keeps every builder page visually identical and lets a single fix reach all of them.

Like every other lib in this workspace, it owns markup, layout, and interaction only: all user-visible strings, values, disabled states, and callbacks are supplied by the consuming app or lib through props. It holds no state of its own and has no knowledge of routing, i18n, feature flags, storage, or any backend API.

Use it when building a form page shell: wire up i18n, data fetching, and form state at the app level, then render these components with the resolved strings and handlers.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-builder-form": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-builder-form/styles.css';
```

## Peer Dependencies

- `react`
- `@tabler/icons-react`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-chat-shared`

## Components

### BuilderFormContainer

The whole builder form page shell — full height, scrollable, with the page background applied.

It renders the header itself: a back control, the title, and a cancel/submit action pair, where submit is the primary action and both actions disable independently (e.g. submit disabled while required fields are empty, cancel disabled while a submission is in flight). Header styling is forwarded through `styles.header`.

Below the header it lays out a three-column body: `left`, the main column (`children`), and `metadata`. Side columns are full width on mobile and a fixed 360px on desktop, with the main column taking the rest. Supplying `left` without `metadata` reserves an empty end column of the same width, so the main column stays optically centered. Column content carries its own padding, borders, and `flex-1` — the container supplies only the column widths and the row/stack direction.

The `styles.cssVars` escape hatch sets arbitrary CSS custom properties on the root, so vars read anywhere inside the form cascade from one place.

```tsx
import { BuilderFormContainer } from '@epam/ai-dial-builder-form';

<BuilderFormContainer
  labels={{
    title: 'New task',
    backButtonLabel: 'Back',
    cancelButtonLabel: 'Cancel',
    submitButtonLabel: 'Save',
  }}
  onBack={() => {}}
  onCancel={() => {}}
  onSubmit={() => {}}
  isCancelDisabled={isSubmitting}
  isSubmitDisabled={!isValid}
  styles={{
    colors: { background: 'var(--bg-layer-2)' },
    header: { typography: { fontClassName: 'dial-h1-text' } },
    cssVars,
  }}
  left={<section className="flex flex-1 flex-col px-8 py-6">{fields}</section>}
  metadata={<aside className="flex flex-1 flex-col px-8 py-6">{summary}</aside>}
>
  <section className="flex flex-1 flex-col px-8 py-6">{editor}</section>
</BuilderFormContainer>;
```

## Types

`BuilderFormContainer`'s header is configured through `labels` (typed `BuilderFormHeaderLabels`) and styled through `styles.header` (typed `BuilderFormHeaderStyles`, holding `BuilderFormHeaderColors` and `BuilderFormHeaderTypography`). All four are exported for consumers building those objects. The header and body components themselves are internal to the container.
