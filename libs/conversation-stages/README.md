# @epam/ai-dial-conversation-stages

Panel component for displaying the processing stages of an agent or LLM response during streaming.

## Overview

`@epam/ai-dial-conversation-stages` visualises the intermediate reasoning and execution steps that an AI agent or model produces while streaming a response. When a model performs tool calls, retrieval operations, or multi-step reasoning, users benefit from seeing the progress rather than staring at a blank loading state. This library renders that progress as a live list of labelled stages, each in one of three states — running (animated spinner), completed (check), or failed (error icon). Related stages can be grouped under a collapsible `CollapsedGroup` row to keep the panel compact during long agentic runs. Use this library in any conversation view that consumes streamed agent responses from the DIAL backend; it accepts the raw stage data array directly from the streaming event and handles all display transitions internally.

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

Renders the full list of stages for the current response.

```tsx
import { StagesPanel } from '@epam/ai-dial-conversation-stages';
import type {
  StagesPanelProps,
  StageType,
} from '@epam/ai-dial-conversation-stages';

<StagesPanel stages={currentStages} />;
```

### CollapsedGroup

A collapsible row that wraps a set of related stages. Clicking it expands or collapses the children.

```tsx
import { CollapsedGroup } from '@epam/ai-dial-conversation-stages';

<CollapsedGroup label="Tool calls" stages={toolCallStages} />;
```

## Types

```tsx
import type {
  StagesPanelProps,
  StagesPanelColors,
  StagesPanelStyles,
  StageType,
  CollapsedGroupProps,
  CollapsedGroupColors,
} from '@epam/ai-dial-conversation-stages';
```

### StageType

Describes a single processing stage shown in the panel.

```tsx
interface StageType {
  id: string;
  name: string;
  status: 'run' | 'completed' | 'failed';
  content?: string;
}
```
