import type { StageRow } from '../models/stage-grouping';
import type { StageNode } from '../models/stage-tree';
import { cleanStageName } from './stage-name';

/**
 * Groups consecutive sibling nodes with the same cleaned name into a `×N`
 * group row; all others render as single rows. Applied to one sibling list
 * at a time, so equal names under different parents never share a group.
 */
export const groupStagesByName = (nodes: StageNode[]): StageRow[] => {
  const rows: StageRow[] = [];
  let index = 0;

  while (index < nodes.length) {
    const node = nodes[index];
    const cleanedName = cleanStageName(node.stage.name).name;

    let end = index + 1;
    while (
      end < nodes.length &&
      cleanStageName(nodes[end].stage.name).name === cleanedName
    ) {
      end += 1;
    }

    const run = nodes.slice(index, end);
    if (run.length > 1) {
      rows.push({ key: node.stage.index, name: cleanedName, attempts: run });
    } else {
      rows.push({ key: node.stage.index, node });
    }

    index = end;
  }

  return rows;
};
