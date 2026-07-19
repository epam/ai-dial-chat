import type { Stage } from '@epam/ai-dial-chat-shared';
import { cleanStageName } from './stage-name';

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

/**
 * Collapses consecutive stages that share the same cleaned name into a
 * single `×N` group row (expanding to the individual attempts); every other
 * stage renders as its own row. Grouping is by cleaned name, not the raw
 * backend string, so a name differing only by its embedded duration still
 * groups correctly.
 */
export const groupStagesByName = (stages: Stage[]): StageRow[] => {
  const rows: StageRow[] = [];
  let index = 0;

  while (index < stages.length) {
    const stage = stages[index];
    const cleanedName = cleanStageName(stage.name).name;

    let end = index + 1;
    while (
      end < stages.length &&
      cleanStageName(stages[end].name).name === cleanedName
    ) {
      end += 1;
    }

    const run = stages.slice(index, end);
    if (run.length > 1) {
      rows.push({
        kind: 'group',
        key: stage.index,
        name: cleanedName,
        attempts: run,
      });
    } else {
      rows.push({ kind: 'single', key: stage.index, stage });
    }

    index = end;
  }

  return rows;
};
