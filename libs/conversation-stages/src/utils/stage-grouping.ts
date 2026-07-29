import type { Stage } from '@epam/ai-dial-chat-shared';
import { StageRow } from '../models/stage-grouping';
import { cleanStageName } from './stage-name';

/** Groups consecutive stages with the same cleaned name into a `×N` group row; all others render as single rows. */
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
        key: stage.index,
        name: cleanedName,
        attempts: run,
      });
    } else {
      rows.push({ key: stage.index, stage });
    }

    index = end;
  }

  return rows;
};
