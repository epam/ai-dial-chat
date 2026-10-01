import type { ScheduledTaskRunDto } from '@epam/ai-dial-chat-api-client';
import { useEffect, useRef, type RefObject } from 'react';
import {
  nextRememberedSchedule,
  type RememberedSchedule,
} from './schedule-resolution';

/** Remembers the resolved schedule and its loaded run ids, so a later switch to a freshly fired run still resolves to that schedule. */
export const useRememberedSchedule = (
  scheduleId: string | undefined,
  historyItems: ScheduledTaskRunDto[],
): RefObject<RememberedSchedule | null> => {
  const rememberedScheduleRef = useRef<RememberedSchedule | null>(null);

  useEffect(() => {
    rememberedScheduleRef.current = nextRememberedSchedule(
      rememberedScheduleRef.current,
      scheduleId,
      historyItems,
    );
  }, [scheduleId, historyItems]);

  return rememberedScheduleRef;
};
