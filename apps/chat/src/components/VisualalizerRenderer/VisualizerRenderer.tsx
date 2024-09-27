import { IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { CustomVisualizer } from '@/src/types/custom-visualizers';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import {
  DEFAULT_CUSTOM_ATTACHMENT_HEIGHT,
  DEFAULT_CUSTOM_ATTACHMENT_WIDTH,
} from '@/src/constants/chat';

import { Spinner } from '../Common/Spinner';

import {
  AttachmentData,
  CustomVisualizerDataLayout,
  Role,
  VisualizerConnectorEvents,
  VisualizerConnectorRequest,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-shared';
import { VisualizerConnector } from '@epam/ai-dial-visualizer-connector';

interface Props {
  attachmentUrl: string;
  renderer: CustomVisualizer;
  mimeType: string;
}

export const VisualizerRenderer = ({
  attachmentUrl,
  renderer,
  mimeType,
}: Props) => {
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const visualizer = useRef<VisualizerConnector | null>(null);
  const { t } = useTranslation(Translation.Chat);

  const [ready, setReady] = useState<boolean>();
  const { url: rendererUrl, title: visualizerTitle } = renderer;

  const dispatch = useAppDispatch();

  const attachmentDataLoading = useAppSelector(
    ConversationsSelectors.selectCustomAttachmentLoading,
  );

  const customAttachmentData = useAppSelector((state) =>
    ConversationsSelectors.selectCustomAttachmentData(state, attachmentUrl),
  );

  const currentConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );

  const isAllowedSendMessage = useAppSelector(
    SettingsSelectors.selectAllowVisualizerSendMessages,
  );

  const scrollWidth =
    iframeContainerRef?.current && iframeContainerRef.current.scrollWidth;

  useEffect(() => {
    if (attachmentUrl && !customAttachmentData) {
      dispatch(
        ConversationsActions.getCustomAttachmentData({
          pathToAttachment: attachmentUrl,
        }),
      );
    }
  }, [attachmentUrl, customAttachmentData, dispatch]);

  const customVisualizerLayout: CustomVisualizerDataLayout = useMemo(() => {
    return {
      ...customAttachmentData?.layout,
      width: scrollWidth
        ? scrollWidth
        : customAttachmentData?.layout.width ?? DEFAULT_CUSTOM_ATTACHMENT_WIDTH,
      height:
        customAttachmentData?.layout.height ?? DEFAULT_CUSTOM_ATTACHMENT_HEIGHT,
    };
  }, [customAttachmentData?.layout, scrollWidth]);

  const sendMessage = useCallback(
    async (visualizer: VisualizerConnector) => {
      await visualizer.ready();

      const messagePayload: AttachmentData = {
        mimeType,
        visualizerData: {
          ...customAttachmentData,
          layout: customVisualizerLayout,
        },
      };

      visualizer.send(
        VisualizerConnectorRequests.sendVisualizeData,
        messagePayload,
      );
    },
    [mimeType, customAttachmentData, customVisualizerLayout],
  );

  useEffect(() => {
    if (iframeContainerRef.current && !visualizer.current) {
      visualizer.current = new VisualizerConnector(iframeContainerRef.current, {
        domain: rendererUrl,
        hostDomain: window.location.origin,
        visualizerName: visualizerTitle,
        loaderStyles: { display: 'none' },
      });

      return () => {
        visualizer.current?.destroy();
        visualizer.current = null;
      };
    }
  }, [rendererUrl, visualizerTitle]);

  useEffect(() => {
    if (
      ready &&
      !!visualizer.current &&
      customAttachmentData &&
      iframeContainerRef.current
    ) {
      sendMessage(visualizer.current);
    }
  }, [ready, attachmentUrl, mimeType, sendMessage, customAttachmentData]);

  useEffect(() => {
    const postMessageListener = (
      event: MessageEvent<VisualizerConnectorRequest>,
    ) => {
      if (event.origin !== rendererUrl) return;

      if (
        event.data.type ===
        `${visualizerTitle}/${VisualizerConnectorEvents.readyToInteract}`
      ) {
        setReady(true);
      }

      if (
        isAllowedSendMessage &&
        event.data.type ===
          `${visualizerTitle}/${VisualizerConnectorEvents.sendMessage}` &&
        event.data.payload &&
        typeof event.data.payload === 'object' &&
        Object.prototype.hasOwnProperty.call(event.data.payload, 'message')
      ) {
        const content = (event.data.payload as { message: string }).message;
        dispatch(
          ConversationsActions.sendMessages({
            conversations: currentConversations,
            deleteCount: 0,
            message: {
              role: Role.User,
              content,
            },
            activeReplayIndex: 0,
          }),
        );
      }
    };

    window.addEventListener('message', postMessageListener, false);

    return () => window.removeEventListener('message', postMessageListener);
  }, [
    visualizerTitle,
    rendererUrl,
    dispatch,
    currentConversations,
    isAllowedSendMessage,
  ]);

  if (!attachmentUrl) {
    return null;
  }

  return (
    <div>
      <div className="mb-2 flex flex-row justify-between">
        <h2>{visualizerTitle}</h2>

        <button
          className="flex gap-2 text-accent-primary"
          onClick={() => visualizer.current && sendMessage(visualizer.current)}
        >
          <IconRefresh size={18} />
          <span>{t('Refresh')}</span>
        </button>
      </div>
      <div
        ref={iframeContainerRef}
        className="size-full"
        style={{
          height: `${customVisualizerLayout.height}px`,
        }}
      >
        {(!ready || attachmentDataLoading) && (
          <div className="absolute z-10 flex size-full items-center bg-layer-1">
            <Spinner className="mx-auto" size={30} />
          </div>
        )}
      </div>
    </div>
  );
};
