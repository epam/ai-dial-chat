import type { Stage } from '@epam/ai-dial-chat-shared';
import { StageRow } from '../models/stage-grouping';
import { cleanStageName } from './stage-name';

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
