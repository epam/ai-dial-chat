# bounded-syntax-highlighting Specification

## Purpose

Limit synchronous syntax-highlighting work and defer rendering of collapsed stage details while preserving complete source text and existing content actions.

## Requirements

### Requirement: Bounded synchronous syntax highlighting

MarkdownCodeBlock and CodeContent SHALL bypass Prism when source exceeds 50,000 UTF-16 code units overall or 2,000 code units on any LF-, CRLF-, or CR-delimited line. They SHALL retain complete text and existing copy/download behavior. Limits SHALL be shared and apply to every language. Eligible content SHALL retain existing lazy highlighting behavior.

Both viewers SHALL memoize eligibility by source text. These bounds are input-size heuristics, not execution deadlines. The behavior SHALL apply without a feature flag. No new endpoints, user-visible strings, telemetry, or persistent caches are introduced; the shared utility accepts only source text.

#### Scenario: Large block with short lines
- **WHEN** content exceeds 50,000 code units with every line below 2,000
- **THEN** both viewers render complete plain text without invoking Prism

#### Scenario: Long line in a smaller block
- **WHEN** a line exceeds 2,000 code units while the block stays below 50,000
- **THEN** both viewers bypass Prism and preserve the original text

#### Scenario: Boundary and changed inputs
- **WHEN** a block is within both inclusive limits, including after replacing oversized content
- **THEN** normal lazy syntax highlighting is eligible again

#### Scenario: Original content actions
- **WHEN** the user copies or downloads a code block whose highlighting was bypassed
- **THEN** the complete original content is supplied to the existing action

### Requirement: Deferred stage disclosure content

Stage details, retry-group children, and multi-stage group panels SHALL mount only while their owning disclosure is expanded. Existing local open state and streaming completion collapse SHALL remain. Closed controls SHALL expose collapsed state and SHALL NOT contain focusable details; reopening SHALL render current stage data. The behavior SHALL be identical across viewport sizes and directions.

CollapsedGroup SHALL own its summary disclosure in local React state; StageItem and StageGroupRow disclosure choices SHALL be held in local React state by the owning stage surface through `useStageExpansion` (a keyed `expansion` map owned by CollapsedGroup or StagesPanel and passed down), with StageItem keeping a local uncontrolled fallback only when rendered standalone. Nothing is persisted. Toggle controls SHALL retain native keyboard activation and expose `aria-expanded` and stable `aria-controls` relationships; closed wrappers SHALL be inert. Existing logical layout properties, directional icons, and LTR code rendering SHALL remain.

#### Scenario: Closed stage receives updated content
- **WHEN** a closed stage receives content updates
- **THEN** Markdown content remains unmounted until expanded, when the latest content is rendered

#### Scenario: Close and reopen a group
- **WHEN** a group is collapsed after expansion
- **THEN** its children unmount and nested disclosures start closed on reopening

#### Scenario: Streaming finishes
- **WHEN** an initially expanded streaming group finishes
- **THEN** its summary remains, the group collapses, and its panel unmounts
