# @epam/ai-dial-conversation-stages

Panel component for displaying the processing stages of an agent or LLM response during streaming.

## Overview

This library visualises the intermediate steps an AI agent or model takes while generating a response — tool calls, sub-tasks, retrieval steps, and so on. Each stage can be in a running, completed, or failed state. Related stages can be collapsed into a group.

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
