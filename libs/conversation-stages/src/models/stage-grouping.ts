import type { Stage } from '@epam/ai-dial-chat-shared';

/** A single ungrouped stage row. */
export interface SingleStageRow {
  kind: 'single';
  /** Stable key for list rendering — the stage's own index. */
  key: number;
  stage: Stage;
}

/** A row formed by collapsing consecutive stages that share the same cleaned name into one `×N` row. */
export interface GroupedStageRow {
  kind: 'group';
  /** Stable key for list rendering — the first attempt's index. */
  key: number;
  /** Shared cleaned display name for the group. */
  name: string;
  /** Individual attempts in original order. */
  attempts: Stage[];
}

/** A row rendered inside a `StagesPanel` — either one stage or a collapsed `×N` group of identical attempts. */
export type StageRow = SingleStageRow | GroupedStageRow;
