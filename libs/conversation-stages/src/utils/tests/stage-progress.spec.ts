import { StageStatus } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { findLiveStage } from '../stage-progress';

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
