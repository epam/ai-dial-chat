import { StageStatus } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { findLiveStage, stagePosition } from '../stage-progress';

const stage = (index: number, status: StageStatus | null) => ({
  index,
  name: `Step ${index}`,
  status,
});

describe('findLiveStage', () => {
  it('returns the last stage with a null status', () => {
    const stages = [
      stage(0, StageStatus.Completed),
      stage(1, null),
      stage(2, null),
    ];
    expect(findLiveStage(stages)?.index).toBe(2);
  });

  it('returns undefined when every stage has settled', () => {
    const stages = [
      stage(0, StageStatus.Completed),
      stage(1, StageStatus.Failed),
    ];
    expect(findLiveStage(stages)).toBeUndefined();
  });

  it('returns undefined for an empty list', () => {
    expect(findLiveStage([])).toBeUndefined();
  });
});

describe('stagePosition', () => {
  it('returns the 1-based position of a stage by its index field', () => {
    const stages = [stage(0, StageStatus.Completed), stage(1, null)];
    expect(stagePosition(stages, stages[1])).toBe(2);
  });

  it('returns 0 when the stage is not present in the list', () => {
    const stages = [stage(0, StageStatus.Completed)];
    expect(stagePosition(stages, stage(9, null))).toBe(0);
  });
});
