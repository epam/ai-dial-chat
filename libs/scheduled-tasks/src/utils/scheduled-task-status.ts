import type { ScheduledTaskItem } from '../models/scheduled-task-item';
import { ScheduledTaskPresentationStatus } from '../models/scheduled-task-item';
import { ScheduledTaskStatus } from '../types/scheduled-task-status';

/** Resolves a card's visual status: an explicit `presentationStatus` wins, then `Completed` over `Paused`, over the schedule pill. */
export const getScheduledTaskStatus = (
  item: ScheduledTaskItem,
): ScheduledTaskStatus => {
  switch (item.presentationStatus) {
    case ScheduledTaskPresentationStatus.Active:
      return ScheduledTaskStatus.Scheduled;
    case ScheduledTaskPresentationStatus.Paused:
      return ScheduledTaskStatus.Paused;
    case ScheduledTaskPresentationStatus.Completed:
      return ScheduledTaskStatus.Completed;
  }
  if (item.isCompleted) {
    return ScheduledTaskStatus.Completed;
  }
  if (item.isActive === false) {
    return ScheduledTaskStatus.Paused;
  }
  return ScheduledTaskStatus.Scheduled;
};
