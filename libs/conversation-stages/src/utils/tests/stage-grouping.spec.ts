import type { Stage } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { groupStagesByName } from '../stage-grouping';
import { buildStageTree } from '../stage-tree';

const stage = (index: number, name: string, parent?: number): Stage => ({
  index,
  name,
  status: null,
  ...(parent !== undefined && { parent_stage_index: parent }),
});

describe('groupStagesByName', () => {
  it('groups consecutive equal cleaned names among roots', () => {
    const rows = groupStagesByName(
      buildStageTree([
        stage(0, 'Search [1s]'),
        stage(1, 'Search [2s]'),
        stage(2, 'Read'),
      ]),
    );

    expect(rows.map((row) => row.key)).toEqual([0, 2]);
    expect(rows[0].name).toBe('Search');
    expect(rows[0].attempts?.map((a) => a.stage.index)).toEqual([0, 1]);
    expect(rows[1].node?.stage.index).toBe(2);
  });

  it('groups consecutive sibling attempts under one parent only', () => {
    const [parent] = buildStageTree([
      stage(0, 'Plan'),
      stage(1, 'Search', 0),
      stage(2, 'Search', 0),
      stage(3, 'Read', 0),
    ]);

    const rows = groupStagesByName(parent.children);

    expect(rows).toHaveLength(2);
    expect(rows[0].attempts?.map((a) => a.stage.index)).toEqual([1, 2]);
    expect(rows[1].node?.stage.index).toBe(3);
  });

  it('never groups equal child names under different parents', () => {
    const roots = buildStageTree([
      stage(0, 'Plan A'),
      stage(1, 'Search', 0),
      stage(2, 'Plan B'),
      stage(3, 'Search', 2),
    ]);

    expect(groupStagesByName(roots)).toHaveLength(2);
    for (const root of roots) {
      const rows = groupStagesByName(root.children);
      expect(rows).toHaveLength(1);
      expect(rows[0].attempts).toBeUndefined();
    }
  });

  it('keeps each grouped parent attempt with its own distinct subtree', () => {
    const rows = groupStagesByName(
      buildStageTree([
        stage(0, 'Plan'),
        stage(1, 'Search one', 0),
        stage(2, 'Plan'),
        stage(3, 'Search two', 2),
      ]),
    );

    expect(rows).toHaveLength(1);
    expect(
      rows[0].attempts?.map((attempt) =>
        attempt.children.map((child) => child.stage.index),
      ),
    ).toEqual([[1], [3]]);
  });
});
