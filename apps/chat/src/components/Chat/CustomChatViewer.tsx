import { useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import { isPlaybackConversation } from '@/src/utils/app/conversation';

import { Conversation } from '@/src/types/chat';

import { ConversationsActions, ModelsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors, UISelectors } from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';

import { IframeRenderer } from '@/src/components/IframeRenderer';

import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequest,
} from '@epam/ai-dial-shared';
import debounce from 'lodash-es/debounce';

interface Props {
  id: string;
  conversation?: Conversation;
  customViewerUrl: string;
  title: string;
}

const UPDATE_CONVERSATION_DEBOUNCE = 300;

export const CustomChatViewer: React.FC<Props> = ({
  id,
  customViewerUrl,
  conversation,
  title,
}) => {
  const theme = useAppSelector(UISelectors.selectThemeState);
  const providerId = useAppSelector(SettingsSelectors.selectProviderId);
  const dispatch = useAppDispatch();

  const router = useRouter();

  const isPreviewConversation = useMemo(() => {
    return router.pathname === Routes.AppsEditor;
  }, [router.pathname]);

  const isPlayback = conversation && isPlaybackConversation(conversation);

  const generateTargetUrl = useCallback(() => {
    try {
      const authProviderQuery = providerId ? `authProvider=${providerId}` : '';
      const conversationIdQuery = conversation?.id
        ? `&conversationId=${encodeURIComponent(conversation.id)}`
        : '';
      const idQuery = id ? `&id=${encodeURIComponent(id)}` : '';
      const themeQuery = theme ? `&theme=${theme}` : '';
      const playbackQuery = isPlayback ? '&playback=true' : '';
      const iframeUrl = `${customViewerUrl}?${authProviderQuery}${conversationIdQuery}${idQuery}${themeQuery}${playbackQuery}`;
      return new URL(iframeUrl);
    } catch (error) {
      console.error('Error generating target URL', error);
    }
  }, [customViewerUrl, id, providerId, theme, conversation?.id, isPlayback]);

  const handleDebouncedUpdateConversation = useMemo(
    () =>
      debounce(
        (conversation: Conversation) => {
          dispatch(
            ModelsActions.updateRecentModels({
              modelId: conversation.model.id,
            }),
          );
          dispatch(
            ConversationsActions.updateConversationSuccess({
              id: conversation.id,
              conversation,
            }),
          );
        },
        UPDATE_CONVERSATION_DEBOUNCE,
        { leading: true },
      ),
    [dispatch],
  );

  const handleDebouncedCreatedConversation = useMemo(
    () =>
      debounce(
        (conversation: Conversation) => {
          dispatch(
            ConversationsActions.addConversations({
              conversations: [conversation],
            }),
          );
          dispatch(
            ConversationsActions.selectConversations({
              conversationIds: [conversation.id],
            }),
          );
          dispatch(
            ModelsActions.updateRecentModels({
              modelId: conversation.model.id,
            }),
          );
          if (isPreviewConversation) {
            dispatch(
              ConversationsActions.setPreviewConversationId(conversation.id),
            );
          }
        },
        UPDATE_CONVERSATION_DEBOUNCE,
        { leading: true },
      ),
    [dispatch, isPreviewConversation],
  );

  const onMessage = useCallback(
    (event: MessageEvent<VisualizerConnectorRequest>) => {
      const eventData = event.data;
      if (!eventData?.type) return;

      const [eventTitle, eventType] = eventData.type.split('/');
      if (eventTitle !== title) return;

      const { conversation } = eventData.payload as {
        conversation?: Conversation;
      };
      if (!conversation) return;

      switch (eventType) {
        case VisualizerConnectorEvents.createdConversationSuccess:
          handleDebouncedCreatedConversation(conversation);
          break;
        case VisualizerConnectorEvents.updatedConversationSuccess:
          handleDebouncedUpdateConversation(conversation);
          break;
      }
    },
    [
      title,
      handleDebouncedCreatedConversation,
      handleDebouncedUpdateConversation,
    ],
  );

  return (
    <div className="size-full">
      {generateTargetUrl()?.href && (
        <IframeRenderer
          iframeUrl={generateTargetUrl()?.href ?? ''}
          title={title}
          width="100%"
          height="100%"
          containerClassName="w-full h-full border-none"
          conversationId={conversation?.id}
          onMessage={onMessage}
        />
      )}
    </div>
  );
};
