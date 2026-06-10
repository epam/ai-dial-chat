import { useMemo } from 'react';

import { ChatEventOperations } from '@/src/types/chat-events';

import { useAppSelector } from '@/src/store/hooks';
import { ChatEventsSelectors } from '@/src/store/selectors';

import { ToolsetLoginEvents } from '@/src/components/Chat/ChatEventsModal/ToolsetLoginEvents/ToolsetLoginEvents';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';

import groupBy from 'lodash-es/groupBy';

const view = withRenderWhen((state) => {
  return !!ChatEventsSelectors.selectEventsList(state).length;
})(() => {
  const events = useAppSelector(ChatEventsSelectors.selectEventsList);

  const { [ChatEventOperations.ToolsetSignIn]: toolsetLoginEvents } = useMemo(
    () => groupBy(events, 'method'),
    [events],
  );

  if (toolsetLoginEvents?.length) {
    return <ToolsetLoginEvents events={events} />;
  }

  return null;
});

export const ChatEventsModal = view;
