import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import {
  getEntitiesFromTemplateMapping,
  replaceDefaultValuesFromContent,
} from '@/src/utils/app/prompts';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { PromptVariablesDialog } from './PromptVariablesDialog';

import isEmpty from 'lodash-es/isEmpty';

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

const ReplayVariablesDialog = () => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const conversation = useAppSelector(
    ConversationsSelectors.selectFirstSelectedConversation,
  );

  const activeMessage =
    conversation?.replay?.replayUserMessagesStack?.[
      conversation?.replay?.activeReplayIndex ?? 0
    ];

  const handleClose = useCallback(() => {
    dispatch(ConversationsActions.setIsReplayRequiresVariables(false));
  }, [dispatch]);

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
    isEmpty(activeMessage.templateMapping)
  )
    return null;

  const template = getEntitiesFromTemplateMapping(
    activeMessage.templateMapping,
  ).reduce(
    (acc, [key, value]) => acc.replaceAll(key, value),
    activeMessage.content,
  );
  const prompt: Prompt = {
    content: replaceDefaultValuesFromContent(activeMessage.content, template),
    id: '',
    folderId: '',
    name: t('Please, enter variables for the template:'),
    description: template,
  };

  return (
    <PromptVariablesDialog
      prompt={prompt}
      onSubmit={handleContentApply}
      onClose={handleClose}
      ignoreOutsideClicks="data-replay-variables"
    />
  );
};
