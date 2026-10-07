import { useEffect, useRef } from 'react';
import { useActiveScheduledTask } from '../../context/ActiveScheduledTaskContext';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import {
  isSameTaskSwitch,
  nextObservedSubject,
  type ObservedSubject,
} from './schedule-resolution';
import { useRememberedSchedule } from './useRememberedSchedule';

/**
 * Closes the sources sidebar when its subject — the schedule — changes,
 * not when the route conversation id changes ([#8840](https://github.com/epam/ai-dial-chat/issues/8840)): a switch between
 * runs of the same task keeps the sidebar open; a switch to another task,
 * a normal conversation, or a no-conversation-id route (bare
 * `/conversations`, a malformed path) closes it (#7213, #7936). Same task
 * means both sides resolve to the same schedule — via `scheduleId`, or via
 * the run history remembered per schedule (the `nextRunTime` refresh picks
 * up a freshly fired run before the conversation list does). A schedule-id
 * blip during a list reload neither closes the sidebar nor erases the kept
 * schedule id: the close fires only on a conversation-id transition.
 * Leaving `/conversations/*` is the Conversation
 * page's unmount cleanup, not this hook.
 */
export const useCloseSourcesSidebarOnSubjectChange = (): void => {
  const { routeConversationId, scheduleId, history } = useActiveScheduledTask();
  const { items: historyItems } = history;
  const { handleClose } = useSourcesSidebar();
  const rememberedScheduleRef = useRememberedSchedule(scheduleId, historyItems);

  const previousSubjectRef = useRef<ObservedSubject | null>(null);

  useEffect(() => {
    const previousSubject = previousSubjectRef.current;
    const currentSubject = nextObservedSubject(
      previousSubject,
      routeConversationId,
      scheduleId,
    );
    previousSubjectRef.current = currentSubject;

    /* Initial mount: the sidebar starts closed, so there is nothing to reset. */
    if (!previousSubject) return;
    /* Same conversation: a resolve flicker during a list reload is not a switch. */
    if (previousSubject.conversationId === currentSubject.conversationId) {
      return;
    }
    /* Same task, different run: the sidebar's subject is unchanged, so it stays open. */
    if (
      isSameTaskSwitch(
        previousSubject,
        currentSubject,
        rememberedScheduleRef.current,
      )
    ) {
      return;
    }
    /* Different task, no-conversation-id route, or a run no loaded history knows. */
    handleClose();
  }, [routeConversationId, scheduleId, handleClose, rememberedScheduleRef]);
};
