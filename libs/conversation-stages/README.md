# @epam/ai-dial-conversation-stages

Panel component for displaying the processing stages of an agent or LLM response during streaming.

## Overview

`@epam/ai-dial-conversation-stages` visualises the intermediate reasoning and execution steps that an AI agent or model produces while streaming a response. When a model performs tool calls, retrieval operations, or multi-step reasoning, users benefit from seeing the progress rather than staring at a blank loading state. This library renders that progress as a live list of labelled stages, each showing a running spinner, a completed check, or a failure icon, with expandable markdown content, per-stage copy buttons, and attempt/duration badges for retried steps. Related stages can be wrapped in a `CollapsedGroup` whose single summary line tracks the run, keeping the panel compact during long agentic runs. Use this library in any conversation view that consumes streamed agent responses; it takes the `Stage[]` array from `@epam/ai-dial-chat-shared` directly and handles all display transitions internally.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-conversation-stages": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-conversation-stages/styles.css';
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-conversation-input`

## Components

### StagesPanel

Renders the full list of stages for the current response. `stages` and `isStreaming` are both required — while `isStreaming` is `true`, every stage with `status: null` shows a live spinner. A completed check is rendered only after that stage explicitly receives `status: "completed"`.

```tsx
import { StagesPanel } from '@epam/ai-dial-conversation-stages';

<StagesPanel
  stages={message.stages}
  isStreaming={isStreaming}
  labels={{
    copyAriaLabel: 'Copy',
    runningAriaLabel: 'Running',
    failedAriaLabel: 'Failed',
    attemptLabel: (n) => `Attempt ${n}`,
  }}
/>;
```

### CollapsedGroup

Wraps `StagesPanel` with a collapsible summary line whose text and default open/closed state track the run. Takes the same `stages` / `isStreaming` inputs; several labels are functions so the host controls plural rules.

```tsx
import { CollapsedGroup } from '@epam/ai-dial-conversation-stages';

<CollapsedGroup
  stages={message.stages}
  isStreaming={isStreaming}
  labels={{
    executedLabel: 'Executed',
    stepsLabel: (count) => `${count} steps`,
    failedCountLabel: (failedCount) => `${failedCount} failed`,
  }}
  styles={{ panel: { stageTextColor: 'var(--text-secondary)' } }}
/>;
```

`CollapsedGroupStyles.panel` is typed `StagesPanelColors` and is forwarded to the
inner `StagesPanel`, so the group and the panel it wraps are themed from one
place.

When finished stage names include duration metadata with a start timestamp,
such as `(7.18s, Start: 11:21:38, End: 11:21:45)`, the summary reports the
elapsed union of those intervals. Parallel stages therefore contribute time
only once. For legacy duration-only names such as `[3.99s]`, it falls back to
summing the available durations.

## Types

```tsx
import type {
  StagesPanelProps,
  StagesPanelColors,
  StagesPanelStyles,
  StagesPanelLabels,
  StageTypography,
  CollapsedGroupProps,
  CollapsedGroupColors,
  CollapsedGroupStyles,
  CollapsedGroupTypography,
  CollapsedGroupLabels,
} from '@epam/ai-dial-conversation-stages';
```

### Stage

The stage shape itself is not defined here — both components accept
`Stage[]` from `@epam/ai-dial-chat-shared`, which is the same type the chat
stream delivers:

```tsx
import type { Stage } from '@epam/ai-dial-chat-shared';
```

A stage with `status: null` is still executing; `isStreaming` controls whether
that unresolved state is animated with a live spinner.

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Selected
elements therefore carry a stable public class.

| Key           | Class                                   | Element                                                       |
| ------------- | --------------------------------------- | ------------------------------------------------------------- |
| `panel`       | `dial-conversation-stages-panel`        | The stages panel root, which carries the themed CSS variables |
| `group`       | `dial-conversation-stages-group`        | The root of a `CollapsedGroup`                                |
| `groupToggle` | `dial-conversation-stages-group-toggle` | Its summary line, which expands and collapses the group       |

```tsx
import { CONVERSATION_STAGES_CLASS } from '@epam/ai-dial-conversation-stages';

CONVERSATION_STAGES_CLASS.groupToggle; // 'dial-conversation-stages-group-toggle'
```

The retry-attempt row inside `StagesPanel` has its own collapse control and
carries no public class: it is an internal row of the panel rather than the
group a host collapses.

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.
