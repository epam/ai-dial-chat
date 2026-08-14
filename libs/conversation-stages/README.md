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

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-conversation-input`
- `@tabler/icons-react`

## Components

### StagesPanel

Renders the full list of stages for the current response. `stages` and `isStreaming` are both required — while `isStreaming` is `true`, the last stage with `status: null` shows a live spinner.

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
    runningStepLabel: (current, total) => `Step ${current} of ${total}`,
  }}
  styles={{ panel: { stageTextColor: 'var(--text-secondary)' } }}
/>;
```

`CollapsedGroupStyles.panel` is typed `StagesPanelColors` and is forwarded to the
inner `StagesPanel`, so the group and the panel it wraps are themed from one
place.

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

A stage with `status: null` is still executing; that is what `isStreaming` keys
the live spinner off.
