import { StageStatus } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { groupStagesByName } from '../stage-grouping';

const stage = (
  index: number,
  name: string,
  status: StageStatus | null = StageStatus.Completed,
) => ({ index, name, status });

describe('groupStagesByName', () => {
  it('collapses consecutive identical names into one group row with all attempts', () => {
    const stages = [
      stage(0, 'Search weather forecast [0.46s]'),
      stage(1, 'Search weather forecast [0.44s]'),
      stage(2, 'Search weather forecast [300.01s]'),
    ];
    const rows = groupStagesByName(stages);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'group',
      name: 'Search weather forecast',
      attempts: stages,
    });
  });

  it('does not group a single occurrence of a name', () => {
    const single = stage(0, 'Parsed user intent');
    const rows = groupStagesByName([single]);

    expect(rows).toEqual([{ kind: 'single', key: 0, stage: single }]);
  });

  it('does not group non-consecutive stages that happen to share a name', () => {
    const stages = [
      stage(0, 'Read file'),
      stage(1, 'Parse input'),
      stage(2, 'Read file'),
    ];
    const rows = groupStagesByName(stages);

    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.kind === 'single')).toBe(true);
  });

  it('groups by cleaned name, ignoring differing embedded durations', () => {
    const stages = [stage(0, 'Attempt [1.0s]'), stage(1, 'Attempt [2.0s]')];
    const rows = groupStagesByName(stages);

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('group');
  });

  it('preserves row order across a mix of single and grouped stages', () => {
    const stages = [
      stage(0, 'Parsed user intent'),
      stage(1, 'Search weather forecast'),
      stage(2, 'Search weather forecast'),
      stage(3, 'Generated report'),
    ];
    const rows = groupStagesByName(stages);

    expect(rows.map((r) => r.kind)).toEqual(['single', 'group', 'single']);
  });

  it('returns an empty array for an empty stage list', () => {
    expect(groupStagesByName([])).toEqual([]);
  });
});
