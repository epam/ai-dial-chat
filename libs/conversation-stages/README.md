# @epam/ai-dial-conversation-stages

Panel component for displaying the processing stages of an agent or LLM response during streaming.

## Overview

`@epam/ai-dial-conversation-stages` visualises the intermediate reasoning and execution steps that an AI agent or model produces while streaming a response. When a model performs tool calls, retrieval operations, or multi-step reasoning, users benefit from seeing the progress rather than staring at a blank loading state. This library renders that progress as a live list of labelled stages, each showing a running spinner, a completed check, or a failure icon, with expandable markdown content, per-stage attachment tiles, per-stage copy buttons, and `×N` count badges for retried steps. Related stages can be wrapped in a `CollapsedGroup` whose single summary line tracks the run, keeping the panel compact during long agentic runs. Use this library in any conversation view that consumes streamed agent responses; it takes the `Stage[]` array from `@epam/ai-dial-chat-shared` directly and handles all display transitions internally.

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

Stage details and repeated-attempt rows mount only while expanded, so closed
stages do not parse Markdown or mount copy controls. Closing removes their
content; reopening renders the latest stage data.

Renders the stages for the current response, nested by `parent_stage_index` (see [Nested stages](#nested-stages)). `stages` and `isStreaming` are both required — while `isStreaming` is `true`, every stage with `status: null` shows a live spinner. A completed check is rendered only after that stage explicitly receives `status: "completed"`.

```tsx
import { StagesPanel } from '@epam/ai-dial-conversation-stages';

<StagesPanel
  stages={message.stages}
  isStreaming={isStreaming}
  labels={{
    copyAriaLabel: 'Copy',
    codeBlockCopiedLabel: 'Copied!',
    tableScrollRegionAriaLabel: 'Scrollable table',
    mathScrollRegionAriaLabel: 'Scrollable formula',
    runningAriaLabel: 'Running',
    failedAriaLabel: 'Failed',
    attemptLabel: (n) => `Attempt ${n}`,
    attachmentClickLabel: 'Preview search result',
  }}
  onAttachmentClick={(attachment) => openPreview(attachment)}
/>;
```

Code blocks in stage content have a copy control but no download control.
`copyAriaLabel` names the copy button (default `'Copy stage content'`),
`codeBlockCopiedLabel` is announced once a copy completes (default
`'Copied!'`), `tableScrollRegionAriaLabel` names a wide table's scroll region
(default `'Scrollable table'`), and `mathScrollRegionAriaLabel` names a wide
block formula's scroll region (default `'Scrollable formula'`).
`CollapsedGroupLabels` carries the same four fields and forwards them to the inner panel.

### Nested stages

`StagesPanel` derives a hierarchy from each stage's optional
`parent_stage_index` and renders a child inside its parent's disclosure, at any
depth. Pass normalized `Stage[]` — for a complete array whose entries have no
`index`, run it through `mapStages` from `@epam/ai-dial-chat-hooks` first, so
positions become the identities the parent references point at.

```tsx
import { StageStatus } from '@epam/ai-dial-chat-shared';
import { StagesPanel } from '@epam/ai-dial-conversation-stages';

<StagesPanel
  stages={[
    { index: 0, name: 'Plan', status: StageStatus.Completed },
    { index: 1, name: 'Search', status: null, parent_stage_index: 0 },
    { index: 2, name: 'Read', status: null, parent_stage_index: 1 },
  ]}
  isStreaming
/>;
```

- **Expansion.** A parent with children is expandable even without its own
  content or attachments. Its body shows its markdown, then its attachment
  tiles, then its child list, and mounts only while expanded. Every stage and
  retry disclosure starts collapsed; the choice is kept per stage `index`
  (retry groups per first attempt) while the surrounding panel is mounted, so
  streaming updates, new siblings and a second attempt forming a `×N` group do
  not reset it, and reopening a parent restores its descendants' choices.
  Collapsing a `CollapsedGroup` summary resets them.
- **Retry grouping.** Consecutive equal cleaned names group into `×N` within
  one sibling list only — equal names under different parents never share a
  group, and each grouped attempt keeps its own descendants.
- **Invalid references.** A reference that is missing, unknown, points at the
  stage itself or forward (not smaller than the child's `index`), or is not a
  nonnegative integer renders the stage at the top level; nothing is dropped.
- **Status and summaries.** Each stage shows only its own status — a completed
  parent keeps its check while a child runs. `CollapsedGroup` counts steps and
  failures over the flat array once; it shows no total execution time.
- **Layout.** Indentation uses logical properties, so it follows `dir`;
  additional indentation stops after the third level while deeper stages stay
  reachable, and disclosure headers are at least 44px tall at the `mobile`
  breakpoint.

### Stage attachments

When a stage carries `attachments` (e.g. a RAG agent's search results), its expanded body renders each one as an `AttachmentCard` tile from `@epam/ai-dial-attachment-input`, in a wrapping row below any `stage.content`. The library maps each raw `MessageAttachment` to a `DisplayAttachment` itself — the host never has to. Clicking a tile calls `onAttachmentClick` with the mapped `DisplayAttachment`; the library never opens a preview or builds a URL itself, so the host decides what "click" means (open a canvas preview, download, navigate, etc.). `attachmentClickLabel` overrides the tile's default click-action label, which otherwise reads as a download/open action rather than a preview.

### CollapsedGroup

The nested panel mounts only while the summary is expanded. Collapsing removes
the panel and resets its nested disclosures; reopening starts those disclosures
closed. Streaming groups still open by default and collapse when the run ends.

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
    copyAriaLabel: 'Copy stage content',
    codeBlockCopiedLabel: 'Copied!',
    tableScrollRegionAriaLabel: 'Scrollable table',
    mathScrollRegionAriaLabel: 'Scrollable formula',
  }}
  styles={{ panel: { stageTextColor: 'var(--text-secondary)' } }}
  onAttachmentClick={(attachment) => openPreview(attachment)}
/>;
```

`onAttachmentClick` is forwarded unchanged to the inner `StagesPanel` (and every `StageItem` it renders) — see [Stage attachments](#stage-attachments) above.

`CollapsedGroupStyles.panel` is typed `StagesPanelColors` and is forwarded to the
inner `StagesPanel`, so the group and the panel it wraps are themed from one
place.

The summary line shows the step and failure counts only. No component in this
library shows a total execution time: neither the summary nor a collapsed `×N`
retry group adds up stage durations. Each stage row still shows its own
duration, parsed from its name (for example `[3.99s]` or
`(7.18s, Start: 11:21:38, End: 11:21:45)`).

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
