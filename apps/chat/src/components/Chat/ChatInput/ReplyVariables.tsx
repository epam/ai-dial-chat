import { useCallback } from 'react';

import { replaceDefaultValuesFromContent } from '@/src/utils/app/prompts';

import { Prompt } from '@/src/types/prompt';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { PromptVariablesDialog } from './PromptVariablesDialog';

export const ReplayVariables = () => {
  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );

  const isReplayRequiresVariables = useAppSelector(
    ConversationsSelectors.selectIsReplayRequiresVariables,
  );

  if (!isReplay || !isReplayRequiresVariables) return null;

  return <ReplayVariablesDialog />;
};

export const ReplayVariablesDialog = () => {
  const dispatch = useAppDispatch();
  const conversation = useAppSelector(
    ConversationsSelectors.selectFirstSelectedConversation,
  );

  const activeMessage =
    conversation?.replay?.replayUserMessagesStack?.[
      conversation?.replay?.activeReplayIndex ?? 0
    ];

  const handleContentApply = useCallback(
    (newContent: string) => {
      if (activeMessage && conversation?.replay?.replayUserMessagesStack) {
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: {
              replay: {
                ...conversation.replay,
                replayUserMessagesStack:
                  conversation.replay.replayUserMessagesStack.map(
                    (message, index) =>
                      index === conversation.replay?.activeReplayIndex ?? 0
                        ? {
                            ...message,
                            content: newContent,
                            templateMapping: undefined,
                          }
                        : message,
                  ),
              },
            },
          }),
        );
        dispatch(
          ConversationsActions.replayConversation({
            conversationId: conversation.id,
            activeReplayIndex: conversation.replay?.activeReplayIndex ?? 0,
            isContinue: true,
          }),
        );
        dispatch(ConversationsActions.setIsReplayRequiresVariables(false));
      }
    },
    [activeMessage, conversation?.id, conversation?.replay, dispatch],
  );

  if (
    !activeMessage ||
    !activeMessage.templateMapping ||
    !Object.keys(activeMessage.templateMapping).length
  )
    return null;

  let template = activeMessage.content;
  Object.entries(activeMessage.templateMapping).forEach(([key, value]) => {
    template = template.replaceAll(key, value);
  });
  const prompt: Prompt = {
    content: replaceDefaultValuesFromContent(activeMessage.content, template),
    id: '',
    folderId: '',
    name: '',
  };

  return (
    <PromptVariablesDialog prompt={prompt} onSubmit={handleContentApply} />
  );
};
