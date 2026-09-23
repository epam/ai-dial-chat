import { describe, expect, it } from 'vitest';
import type { ScheduledTaskItem } from '../../models/scheduled-task-item';
import { ScheduledTaskPresentationStatus } from '../../models/scheduled-task-item';
import { ScheduledTaskStatus } from '../../types/scheduled-task-status';
import { getScheduledTaskStatus } from '../scheduled-task-status';

const buildItem = (
  overrides?: Partial<ScheduledTaskItem>,
): ScheduledTaskItem => ({
  id: 'sched_1',
  displayName: 'Competitor Updates',
  scheduleLabel: 'Every Monday 12:00',
  ...overrides,
});

describe('getScheduledTaskStatus', () => {
  it('resolves a completed item to the completed status, winning over paused', () => {
    expect(
      getScheduledTaskStatus(buildItem({ isCompleted: true, isActive: false })),
    ).toBe(ScheduledTaskStatus.Completed);
  });

  it('resolves an inactive item to the paused status', () => {
    expect(getScheduledTaskStatus(buildItem({ isActive: false }))).toBe(
      ScheduledTaskStatus.Paused,
    );
  });

  it('resolves an active item to the scheduled status', () => {
    expect(getScheduledTaskStatus(buildItem({ isActive: true }))).toBe(
      ScheduledTaskStatus.Scheduled,
    );
  });

  it('resolves an item with omitted isActive to the scheduled status', () => {
    expect(getScheduledTaskStatus(buildItem())).toBe(
      ScheduledTaskStatus.Scheduled,
    );
  });

  it('resolves an explicit presentationStatus over the derived isCompleted/isActive statuses', () => {
    expect(
      getScheduledTaskStatus(
        buildItem({
          presentationStatus: ScheduledTaskPresentationStatus.Active,
          isCompleted: true,
        }),
      ),
    ).toBe(ScheduledTaskStatus.Scheduled);
    expect(
      getScheduledTaskStatus(
        buildItem({
          presentationStatus: ScheduledTaskPresentationStatus.Paused,
          isCompleted: true,
        }),
      ),
    ).toBe(ScheduledTaskStatus.Paused);
    expect(
      getScheduledTaskStatus(
        buildItem({
          presentationStatus: ScheduledTaskPresentationStatus.Completed,
          isActive: false,
        }),
      ),
    ).toBe(ScheduledTaskStatus.Completed);
  });
});
